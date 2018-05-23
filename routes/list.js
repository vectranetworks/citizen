const { Router } = require('express');
const _ = require('lodash');

const { findAll, getVersions } = require('../lib/store');
const { makeUrl } = require('../lib/util');

const router = Router();

// https://www.terraform.io/docs/registry/api.html#search-modules
router.get('/search', async (req, res) => {
  if (!req.query.q) {
    return res.status(400).render('error', {
      message: 'q parameter required.',
    });
  }

  // `q` search in `name` field.
  // It could be extended to other fields. Specification said it depends on registry implementation.
  const options = {
    offset: req.query.offset,
    limit: req.query.limit,
    provider: req.query.provider,
    namespace: req.query.namespace,
    verified: req.query.verified,
    selector: {
      name: {
        $regex: new RegExp(req.query.q),
      },
    },
  };

  if (req.params.namespace) {
    options.namespace = req.params.namespace;
  }

  const data = await findAll(options);
  if (data.meta.nextOffset) {
    data.meta.nextUrl = makeUrl(req, {
      limit: data.meta.limit,
      offset: data.meta.nextOffset,
    });
  }
  return res.render('modules/list', data);
});

// https://www.terraform.io/docs/registry/api.html#list-modules
router.get(['/', '/:namespace'], async (req, res) => {
  const options = {
    offset: req.query.offset,
    limit: req.query.limit,
    provider: req.query.provider,
    verified: req.query.verified,
  };
  if (req.params.namespace) {
    options.namespace = req.params.namespace;
  }

  const data = await findAll(options);
  if (data.meta.nextOffset) {
    data.meta.nextUrl = makeUrl(req, {
      limit: data.meta.limit,
      offset: data.meta.nextOffset,
    });
  }
  res.render('modules/list', data);
});

// https://www.terraform.io/docs/registry/api.html#list-available-versions-for-a-specific-module
router.get('/:namespace/:name/:provider/versions', async (req, res, next) => {
  const options = {
    namespace: req.params.namespace,
    name: req.params.name,
    provider: req.params.provider,
  };

  try {
    const versions = await getVersions(options);
    res.render('modules/versions', {
      source: `${req.params.namespace}/${req.params.name}/${req.params.provider}`,
      versions,
    });
  } catch (e) {
    next(e);
  }
});

// https://www.terraform.io/docs/registry/api.html#list-latest-version-of-module-for-all-providers
router.get('/:namespace/:name', async (req, res) => {
  const options = {
    offset: 0,
    // FIXME: to support for too many modules
    limit: 100,
    selector: {
      namespace: req.params.namespace,
      name: req.params.name,
    },
  };

  const result = await findAll(options);
  const grouped = _.groupBy(result.modules, m => `${m.namespace}/${m.name}/${m.provider}`);

  const modules = Object.keys(grouped).map((key) => {
    const sorted = _.orderBy(grouped[key], ['versions']);
    return sorted[sorted.length - 1];
  });

  const totalCount = modules.length;

  const offset = +req.query.offset || 0;
  const limit = +req.query.limit || 15;
  const nextOffset = (offset + 1) * limit;
  const hasNext = totalCount > nextOffset;

  const pagedModules = _.slice(modules, offset, nextOffset);

  res.render('modules/list', {
    meta: {
      limit,
      currentOffset: offset,
      nextOffset: hasNext ? nextOffset : null,
      nextUrl: hasNext ? makeUrl(req, { limit, offset: nextOffset }) : null,
    },
    modules: pagedModules,
  });
});

module.exports = router;

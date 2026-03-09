import express from 'express';

const router = express.Router();

// TODO: revisit oembed implementation
router.get('/', async (req, res) => {
  const author = req.query.author as string;

  // https://oembed.com/#section2.3
  res.json({
    type: 'link',
    version: '1.0',
    author_name: author,
  });
});

export default router;

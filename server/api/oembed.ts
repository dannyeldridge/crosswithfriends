import express from 'express';

const router = express.Router();

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

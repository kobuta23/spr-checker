import express, { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import axios from 'axios';

// Add explicit type annotation for the router
const router: Router = express.Router();

// Use RequestHandler type for proper typing
const proxyImageHandler: RequestHandler = (req, res, next) => {
  const imageUrl = req.query.url as string;
  
  if (!imageUrl) {
    res.status(400).send('No image URL provided');
    return;
  }
  
  // Use Promise without async/await to avoid the type issue
  axios({
    method: 'get',
    url: imageUrl,
    responseType: 'arraybuffer'
  })
    .then(response => {
      // Set appropriate content type
      const contentType = response.headers['content-type'];
      res.setHeader('Content-Type', contentType);
      
      // Set caching headers
      res.setHeader('Cache-Control', 'public, max-age=86400');
      
      res.send(response.data);
    })
    .catch(error => {
      console.error('Image proxy error:', error);
      res.status(500).send('Error fetching image');
    });
};

router.get('/proxy-image', proxyImageHandler);

export default router; 
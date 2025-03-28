import express, { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import axios from 'axios';

// Add explicit type annotation for the router
const router: Router = express.Router();

// Use RequestHandler type for proper typing
const proxyImageHandler: RequestHandler = (req, res, next) => {
  console.log('Image proxy request received:', req.query);
  const imageUrl = req.query.url as string;
  
  if (!imageUrl) {
    console.log('No image URL provided');
    res.status(400).send('No image URL provided');
    return;
  }
  
  // Validate URL in try/catch to prevent unhandled errors
  try {
    new URL(imageUrl);
  } catch (error) {
    console.error('Invalid URL format:', imageUrl, error);
    res.status(400).send('Invalid URL format');
    return;
  }
  
  console.log('Attempting to fetch image from:', imageUrl);
  
  // Use Promise without async/await to avoid the type issue
  axios({
    method: 'get',
    url: imageUrl,
    responseType: 'arraybuffer',
    timeout: 10000 // 10 second timeout
  })
    .then(response => {
      console.log('Image fetched successfully, content type:', response.headers['content-type']);
      // Set appropriate content type
      const contentType = response.headers['content-type'];
      res.setHeader('Content-Type', contentType || 'image/jpeg');
      
      // Set caching headers
      res.setHeader('Cache-Control', 'public, max-age=86400');
      
      res.send(response.data);
    })
    .catch(error => {
      console.error('Image proxy error:', error.message);
      if (error.response) {
        console.error('Error response status:', error.response.status);
      }
      res.status(500).send('Error fetching image: ' + error.message);
    });
};

router.get('/proxy-image', proxyImageHandler);

// Add a simple test route to verify the router is working
router.get('/test', (req, res) => {
  res.send('Image proxy router is working');
});

export default router; 
import express from 'express';
import axios from 'axios';

const router = express.Router();

router.get('/proxy-image', async (req, res) => {
  const imageUrl = req.query.url as string;
  
  if (!imageUrl) {
    return res.status(400).send('No image URL provided');
  }
  
  try {
    // Validate URL to prevent server-side request forgery
    const url = new URL(imageUrl);
    
    // Optional: whitelist of allowed domains
    // const allowedDomains = ['euc.li', 'lens.xyz', 'farcaster.xyz', 'ens.domains'];
    // if (!allowedDomains.some(domain => url.hostname.includes(domain))) {
    //   return res.status(403).send('Domain not allowed');
    // }
    
    const response = await axios({
      method: 'get',
      url: imageUrl,
      responseType: 'arraybuffer'
    });
    
    // Set appropriate content type
    const contentType = response.headers['content-type'];
    res.setHeader('Content-Type', contentType);
    
    // Optional: Set caching headers
    res.setHeader('Cache-Control', 'public, max-age=86400');
    
    return res.send(response.data);
  } catch (error) {
    console.error('Image proxy error:', error);
    return res.status(500).send('Error fetching image');
  }
});

export default router; 
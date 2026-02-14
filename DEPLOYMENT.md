# 🚀 Deployment Guide

## Production Deployment Steps

### 1. Build the Application

```bash
# Install dependencies
npm install

# Build for production
npm run build

# The build output will be in the `dist/` directory
```

### 2. Choose Hosting Platform

#### Option A: Netlify (Recommended)

1. **Create Netlify Account**
   - Sign up at [netlify.com](https://netlify.com)
   - Connect your Git repository or upload the `dist/` folder

2. **Build Settings**
   ```yaml
   Build command: npm run build
   Publish directory: dist
   ```

3. **Environment Variables** (if needed)
   - Add any required environment variables in Netlify dashboard

4. **Deploy**
   - Automatic deployment on Git push
   - Or manual drag-and-drop of `dist/` folder

#### Option B: Vercel

1. **Install Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **Deploy**
   ```bash
   vercel --prod
   ```

3. **Configuration**
   - Vercel automatically detects the project settings
   - Add environment variables in Vercel dashboard

#### Option C: Traditional Hosting

1. **Build the project**
   ```bash
   npm run build
   ```

2. **Upload files**
   - Upload the entire `dist/` folder to your web server
   - Ensure the server supports single-page applications

3. **Server Configuration** (Apache example)
   ```apache
   <IfModule mod_rewrite.c>
     RewriteEngine On
     RewriteBase /
     RewriteRule ^index\.html$ - [L]
     RewriteCond %{REQUEST_FILENAME} !-f
     RewriteCond %{REQUEST_FILENAME} !-d
     RewriteRule . /index.html [L]
   </IfModule>
   ```

### 3. SSL Certificate

- **Required** for camera access and HTTPS APIs
- Most hosting providers provide free SSL certificates
- Ensure the site loads over `https://`

### 4. Performance Optimization

#### Enable Gzip Compression
```nginx
gzip on;
gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
```

#### Set Cache Headers
```nginx
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
  expires 1y;
  add_header Cache-Control "public, immutable";
}
```

### 5. Testing Before Going Live

1. **Camera Permissions Test**
   - Verify camera access works on mobile and desktop
   - Test different browsers (Chrome, Firefox, Safari)

2. **Performance Test**
   - Check load times (should be under 10 seconds)
   - Test on low-end devices

3. **Functionality Test**
   - Face tracking accuracy
   - Frame selection
   - Feedback collection

### 6. Monitoring

#### Google Analytics (Optional)
```javascript
// Add to index.html if needed
gtag('config', 'GA_MEASUREMENT_ID');
```

#### Error Tracking
- Monitor browser console for errors
- Check network tab for failed requests

### 7. Maintenance

#### Regular Updates
- Update dependencies monthly
- Test new browser versions
- Monitor MediaPipe API changes

#### Backup Strategy
- Keep source code in Git
- Backup configuration files
- Document any custom changes

## 🌐 CDN Configuration

### MediaPipe CDN
```javascript
// In your code, use reliable CDN
const MEDIAPIPE_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe';
```

### OpenCV.js CDN
```html
<!-- Use reliable OpenCV CDN -->
<script src="https://docs.opencv.org/4.x/opencv.js"></script>
```

## 🔒 Security Considerations

### HTTPS Required
- Camera access requires HTTPS
- All modern browsers enforce this for getUserMedia

### Content Security Policy
```html
<meta http-equiv="Content-Security-Policy" 
      content="default-src 'self'; 
               script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://docs.opencv.org;
               style-src 'self' 'unsafe-inline';
               img-src 'self' data:;
               media-src 'self';
               connect-src 'self';">
```

## 📱 Mobile Optimization

### Viewport Meta Tag
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0">
```

### Touch Events
- Ensure all UI elements work with touch
- Test on various screen sizes

## 🚨 Troubleshooting

### Common Issues

1. **Camera Not Working**
   - Check HTTPS is enabled
   - Verify browser permissions
   - Test in different browsers

2. **Slow Loading**
   - Check CDN availability
   - Optimize images and assets
   - Consider lazy loading

3. **Tracking Not Working**
   - Verify MediaPipe loads correctly
   - Check console for errors
   - Test with good lighting

### Performance Issues

1. **High CPU Usage**
   - Reduce camera resolution
   - Optimize rendering settings
   - Check for memory leaks

2. **Memory Leaks**
   - Properly cleanup Three.js objects
   - Remove event listeners
   - Clear intervals and timeouts

## 📞 Support

For deployment issues:
- Check browser console for errors
- Verify all files are uploaded correctly
- Test with different browsers and devices

---

**Remember:** Always test thoroughly before going to production!

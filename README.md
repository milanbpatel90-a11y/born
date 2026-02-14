# 👁️ Optical Try-On v5.0

Professional web-based virtual glasses try-on with **ear detection** and **temple angle adjustment**.

## ✨ Features

- **MediaPipe FaceMesh** - 468 facial landmarks with iris refinement
- **MediaPipe Holistic** - Ear detection for realistic temple positioning
- **OpenCV solvePnP** - Metric head pose estimation (mm accuracy)
- **Runtime Camera Calibration** - Device-specific focal length estimation
- **Sellion Offset Calculation** - Anatomically correct nose bridge placement
- **Temple Angle Adjustment** - Ears position → temple angle mapping
- **Face Profile Curvature** - Natural frame wrap based on face shape
- **Kalman Filtering** - Smooth pose tracking, eliminates jitter
- **Exposure Control** - Optimized camera settings for retail lighting

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ 
- npm or yarn
- Modern browser (Chrome/Firefox/Safari)

### Installation

```bash
# Clone or download this repository
git clone <repo-url>
cd optical-tryon-v5.0

# Install dependencies
npm install

# Start development server
npm run dev
```

### Build for Production

```bash
# Build optimized bundle
npm run build

# Preview production build
npm run preview
```

## 📱 Deployment

### Option 1: Netlify (Recommended)

```bash
npm install -g netlify-cli
netlify deploy --prod
```

### Option 2: Vercel

```bash
npm install -g vercel
vercel --prod
```

### Option 3: Static Hosting

```bash
# Build
npm run build

# Upload dist/ folder to your hosting provider
```

## 🏪 Store Setup Guide

### Hardware Requirements
- Tablet/iPad (minimum 10" screen)
- Stable WiFi connection
- Good ambient lighting
- Tablet stand (optional but recommended)

### Setup Steps

1. **Deploy to hosting** (Netlify/Vercel recommended)
2. **Bookmark URL** on tablet home screen
3. **Test calibration** with staff member
4. **Position tablet** at eye level, ~50cm from customer seat
5. **Train staff** on basic troubleshooting

### Staff Training Script

```
1. "Would you like to try our virtual glasses try-on?"
2. "Please sit comfortably and look at the camera"
3. "Stay about arm's length away (~50cm)"
4. "Keep your ears visible for best results"
5. "The system will calibrate in 5 seconds..."
```

### Troubleshooting

| Issue | Solution |
|-------|----------|
| Camera not detected | Check permissions, refresh page |
| Poor tracking | Adjust lighting, ensure face is visible |
| Long loading time | Check internet connection, wait for OpenCV |
| Temples floating | Ensure ears are visible, adjust head position |
| Calibration fails | Move closer/further, ensure good lighting |

## 📊 Analytics & Feedback

The system includes:
- Session tracking
- Frame selection events
- Customer feedback collection
- Technical metrics (calibration success, confidence scores)

Feedback is stored in localStorage and can be exported via browser console:

```javascript
JSON.parse(localStorage.getItem('vto_feedback'))
```

## 💰 Pricing Model (For Resellers)

| Plan | Price | Features |
|------|-------|----------|
| Basic | ₹500/month | 10 frames, basic analytics |
| Pro | ₹1,500/month | 50 frames, advanced analytics, custom branding |
| Premium | ₹3,000/month | Unlimited frames, multi-location, API access |

## 📁 Project Structure

```
optical-tryon-v5.0/
├── src/                  # Source code
│   ├── camera/          # Camera setup & stream management
│   ├── tracking/        # Face tracking & pose estimation
│   ├── anatomy/         # Optical anatomy calculations
│   ├── rendering/       # Three.js rendering
│   ├── ui/             # User interface components
│   └── utils/          # Utilities & helpers
├── assets/              # 3D models & configuration
└── dist/               # Build output
```

## 🔧 Customization

### Add Custom Frame Models

1. Create GLB model with proper scale (1 unit = 1mm)
2. Create JSON calibration file:
```json
{
  "modelName": "Aviator Pro",
  "sellionY": 1.8,
  "sellionZ": -0.9,
  "defaultTempleAngle": 8.5,
  "templeLength": 145,
  "bridgeWidth": 18
}
```
3. Add to `assets/config/frameLibrary.json` 

### Adjust Calibration Parameters

Edit `src/anatomy/opticalAnatomy.js`:
```javascript
export const ANATOMY_CONFIG = {
  REAL_IPD_MM: 63,              // Average interpupillary distance
  CALIBRATION_DISTANCE_MM: 500, // Standard fitting distance
  SELLION_DEPTH_OFFSET: -7.8,   // Sellion depth from nose tip
  TEMPLE_SCALE: 0.92,           // Temple width scaling factor
  REF_HEAD_WIDTH_PX: 182        // Reference head width at 500mm
};
```

## 📞 Support

For technical issues or questions:
- Email: support@opticaltryon.com
- GitHub Issues: [Link to repo issues]

## 📄 License

Commercial license required for production use. Contact for pricing.

---

**Built with:** MediaPipe, OpenCV.js, Three.js, Vite

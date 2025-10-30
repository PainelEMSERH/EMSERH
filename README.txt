EMSERH patch - 2025-10-29

WHAT THIS DOES
- Replaces components/utils/Utils.js with a version that tolerates CSS variables
  and modern color spaces (oklch/hsl/rgb/hex). This fixes the runtime error:
    "Error: Unsupported color format" from app-index.tsx / Utils.js:48:11

HOW TO APPLY
1) In your repository, replace the file:
     components/utils/Utils.js
   with the one contained in this patch.
2) Commit and deploy.
3) No other files need changes.

No code needs to be manually edited. Just substitute the file.

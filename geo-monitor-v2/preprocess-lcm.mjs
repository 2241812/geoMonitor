import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const inputDir = 'raw LCM geoJSON';
const outputDir = 'public/geoJSON/LCM';

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Map of raw filename -> output filename
const fileMap = {
  'ABR_LCM2025.geojson': 'ABR_LCM.topojson',
  'ABU_LCM2025.geojson': 'ABU_LCM.topojson',
  'ACH_LCM2025.geojson': 'UCH_LCM.topojson', // NOTE: ACH maps to UCH basin code
  'AGN_LCM2025.geojson': 'AGN_LCM.topojson',
  'AMB_LCM2025.geojson': 'AMB_LCM.topojson',
  'ARI_LCM2025.geojson': 'ARI_LCM.topojson',
  'BUD_LCM2025.geojson': 'BUD_LCM.topojson',
  'CAB_LCM2025.geojson': 'CAB_LCM.topojson',
  'MLG_LCM2025.geojson': 'MLG_LCM.topojson',
  'NAG_LCM2025.geojson': 'NAG_LCM.topojson',
  'SIF_LCM2025.geojson': 'SIF_LCM.topojson',
  'SMR_LCM2025.geojson': 'SMR_LCM.topojson',
  'UMT_LCM2025.geojson': 'UMT_LCM.topojson',
  'ZUM_LCM2025.geojson': 'ZUM_LCM.topojson',
};

for (const [inFile, outFile] of Object.entries(fileMap)) {
  const inputPath = path.join(inputDir, inFile);
  const outputPath = path.join(outputDir, outFile);
  
  if (!fs.existsSync(inputPath)) {
    console.error(`Skipping ${inFile}: file not found`);
    continue;
  }
  
  const inSize = (fs.statSync(inputPath).size / 1024 / 1024).toFixed(2);
  console.log(`Processing ${inFile} (${inSize} MB) -> ${outFile}...`);
  
  const startTime = Date.now();
  
  try {
    // using 15% simplify and TopoJSON format to significantly reduce size
    const cmd = `npx --yes mapshaper "${inputPath}" -simplify visvalingam 15% -filter-fields LCM_CLASS,ENR_CLCODE,AREA_HA -o format=topojson "${outputPath}"`;
    execSync(cmd, { stdio: 'inherit' });
    
    const outSize = (fs.statSync(outputPath).size / 1024 / 1024).toFixed(2);
    const timeTaken = ((Date.now() - startTime) / 1000).toFixed(1);
    
    console.log(`Done! Size: ${outSize} MB (took ${timeTaken}s)\n`);
  } catch (error) {
    console.error(`Error processing ${inFile}:`, error.message);
  }
}
console.log('All LCM files processed successfully!');

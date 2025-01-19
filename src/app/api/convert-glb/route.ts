import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import os from 'os';

const execAsync = promisify(exec);

export async function POST(req: Request) {
  try {
    const { glbUrl, designId } = await req.json();
    console.log('Processing URL:', glbUrl);

    const tempDir = path.join(os.tmpdir(), 'glb-conversions');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Download GLB file
    console.log('Downloading GLB file...');
    const glbResponse = await fetch(glbUrl);
    if (!glbResponse.ok) {
      throw new Error(`Failed to fetch GLB: ${glbResponse.status}`);
    }
    
    const glbBuffer = await glbResponse.arrayBuffer();
    const glbPath = path.join(tempDir, `${designId}.glb`);
    const stlPath = path.join(tempDir, `${designId}.stl`);
    
    console.log('Writing GLB to temp file:', glbPath);
    fs.writeFileSync(glbPath, Buffer.from(glbBuffer));

    // Use full path to Blender executable
    const blenderPath = process.platform === 'darwin' 
      ? '/Applications/Blender.app/Contents/MacOS/Blender'
      : 'blender'; // Add Windows/Linux paths as needed
      
    const blenderScript = path.join(process.cwd(), 'scripts', 'convert_glb.py');
    
    console.log('Checking paths:');
    console.log('- Blender path exists:', fs.existsSync(blenderPath));
    console.log('- Script path exists:', fs.existsSync(blenderScript));
    console.log('- GLB path exists:', fs.existsSync(glbPath));
    
    const blenderCommand = `"${blenderPath}" --background --python "${blenderScript}" -- "${glbPath}" "${stlPath}"`;
    console.log('Running command:', blenderCommand);
    
    const { stdout, stderr } = await execAsync(blenderCommand);
    console.log('Conversion output:', stdout);
    if (stderr) console.error('Conversion errors:', stderr);

    if (!fs.existsSync(stlPath)) {
      throw new Error('STL file was not created');
    }

    const stlBuffer = fs.readFileSync(stlPath);

    // Cleanup
    try {
      fs.unlinkSync(glbPath);
      fs.unlinkSync(stlPath);
    } catch (error) {
      console.error('Cleanup error:', error);
    }

    return new NextResponse(stlBuffer, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${designId}.stl"`
      }
    });

  } catch (error) {
    console.error('Conversion error:', error);
    return NextResponse.json({ 
      error: 'Failed to convert file',
      details: error.message 
    }, { status: 500 });
  }
} 
import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function execCommand(command: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    console.log('Executing command:', command, args.join(' '));
    
    const childProcess = spawn(command, args, {
      env: { ...process.env, PYTHONPATH: process.env.PYTHONPATH || '' }
    });

    let stdout = '';
    let stderr = '';

    childProcess.stdout.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      console.log('Blender stdout:', output);
    });

    childProcess.stderr.on('data', (data) => {
      const error = data.toString();
      stderr += error;
      console.error('Blender stderr:', error);
    });

    childProcess.on('close', (code) => {
      console.log(`Blender process exited with code ${code}`);
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`Blender process failed with code ${code}\nOutput: ${stdout}\nErrors: ${stderr}`));
      }
    });

    childProcess.on('error', (err) => {
      console.error('Failed to start Blender process:', err);
      reject(err);
    });
  });
}

export async function POST(req: Request) {
  const tempFiles: string[] = [];
  let tempDir: string | null = null;

  try {
    const { glbUrl, designId } = await req.json();
    console.log('Processing URL:', glbUrl);

    // Create temp directory with unique name
    tempDir = path.join(process.cwd(), 'tmp', designId);
    fs.mkdirSync(tempDir, { recursive: true });
    console.log('Created temp directory:', tempDir);

    // Download GLB file
    console.log('Downloading GLB file...');
    const glbResponse = await fetch(glbUrl);
    if (!glbResponse.ok) {
      throw new Error(`Failed to fetch GLB: ${glbResponse.status}`);
    }
    
    const glbBuffer = await glbResponse.arrayBuffer();
    const glbPath = path.join(tempDir, `${designId}.glb`);
    const stlPath = path.join(tempDir, `${designId}.stl`);
    
    tempFiles.push(glbPath, stlPath);
    
    // Write GLB file
    fs.writeFileSync(glbPath, Buffer.from(glbBuffer));
    console.log('GLB file written:', glbPath);
    console.log('GLB file size:', fs.statSync(glbPath).size);

    // Verify paths
    const blenderPath = process.platform === 'darwin' 
      ? '/Applications/Blender.app/Contents/MacOS/Blender'
      : 'blender';
    const blenderScript = path.join(process.cwd(), 'scripts', 'convert_glb.py');

    console.log('Checking paths:');
    console.log('- Blender exists:', fs.existsSync(blenderPath));
    console.log('- Script exists:', fs.existsSync(blenderScript));
    console.log('- GLB exists:', fs.existsSync(glbPath));

    // Run Blender - removed --python-verbose flag
    console.log('Running Blender conversion...');
    try {
      const { stdout, stderr } = await execCommand(blenderPath, [
        '--background',
        '--python',
        blenderScript,
        '--',
        glbPath,
        stlPath
      ]);

      console.log('Blender conversion completed');
      console.log('Stdout:', stdout);
      if (stderr) console.error('Stderr:', stderr);

    } catch (error) {
      console.error('Blender execution failed:', error);
      throw error;
    }

    // Verify STL file
    if (!fs.existsSync(stlPath)) {
      throw new Error('STL file was not created');
    }

    const stlBuffer = fs.readFileSync(stlPath);
    console.log('STL file size:', stlBuffer.length);

    if (stlBuffer.length === 0) {
      throw new Error('STL file is empty');
    }

    return new NextResponse(stlBuffer, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${designId}.stl"`,
        'Content-Length': stlBuffer.length.toString()
      }
    });

  } catch (error) {
    console.error('Conversion error:', error);
    return NextResponse.json({ 
      error: 'Failed to convert file',
      details: error.message 
    }, { status: 500 });

  } finally {
    // Cleanup
    try {
      for (const file of tempFiles) {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
          console.log('Cleaned up:', file);
        }
      }
      if (tempDir && fs.existsSync(tempDir)) {
        fs.rmdirSync(tempDir);
        console.log('Cleaned up temp directory:', tempDir);
      }
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  }
} 
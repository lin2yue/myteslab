const fs = require('fs');
const { createCanvas } = require('canvas');

async function convertSvgToPng(svgPath, pngPath, color) {
  const svgContent = fs.readFileSync(svgPath, 'utf8');
  const size = 24;

  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  const parser = new DOMParser();
  const doc = parser.parseFromString(svgContent, 'image/svg+xml');
  const svgElement = doc.querySelector('svg');

  const paths = svgElement.querySelectorAll('path, polygon, circle');
  const strokes = svgElement.getAttribute('stroke') || '#666666';
  const strokeWidth = parseFloat(svgElement.getAttribute('stroke-width')) || 2;
  const strokeLinecap = svgElement.getAttribute('stroke-linecap') || 'round';
  const strokeLinejoin = svgElement.getAttribute('stroke-linejoin') || 'round';

  ctx.strokeStyle = color || strokes;
  ctx.lineWidth = strokeWidth;
  ctx.lineCap = strokeLinecap;
  ctx.lineJoin = strokeLinejoin;

  paths.forEach(path => {
    const d = path.getAttribute('d') || path.getAttribute('points');

    if (path.tagName === 'circle') {
      const cx = parseFloat(path.getAttribute('cx'));
      const cy = parseFloat(path.getAttribute('cy'));
      const r = parseFloat(path.getAttribute('r'));
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    } else if (path.tagName === 'polygon') {
      const points = d.split(' ').map(p => {
        const [x, y] = p.split(',');
        return { x: parseFloat(x), y: parseFloat(y) };
      });

      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.closePath();
      ctx.stroke();
    } else {
      const commands = d.match(/[A-Za-z][^A-Za-z]*/g) || [];
      ctx.beginPath();

      for (const cmd of commands) {
        const type = cmd[0];
        const args = cmd.slice(1).trim().split(/[\s,]+/).map(Number);

        switch(type) {
          case 'M':
            ctx.moveTo(args[0], args[1]);
            break;
          case 'L':
            ctx.lineTo(args[0], args[1]);
            break;
          case 'H':
            ctx.lineTo(args[0], 0);
            break;
          case 'V':
            ctx.lineTo(0, args[0]);
            break;
          case 'C':
            ctx.bezierCurveTo(args[0], args[1], args[2], args[3], args[4], args[5]);
            break;
          case 'Z':
            ctx.closePath();
            break;
        }
      }
      ctx.stroke();
    }
  });

  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(pngPath, buffer);
}

convertSvgToPng(
  '/Users/linpengfei/work/t-media/src/static/tabbar/tutorial.svg',
  '/Users/linpengfei/work/t-media/src/static/tabbar/tutorial.png',
  '#666666'
).then(() => console.log('tutorial.png created'));

convertSvgToPng(
  '/Users/linpengfei/work/t-media/src/static/tabbar/tutorial-active.svg',
  '/Users/linpengfei/work/t-media/src/static/tabbar/tutorial-active.png',
  '#FFFFFF'
).then(() => console.log('tutorial-active.png created'));

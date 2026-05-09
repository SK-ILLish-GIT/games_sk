import React, { useEffect, useRef } from 'react';

export default function RibbonCursor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;

    let mouse = { x: width / 2, y: height / 2, active: false };

    // Point history for ribbon
    const history: { x: number; y: number }[] = [];
    const historySize = 50; // Number of segments in the ribbon

    // Add initial points
    for (let i = 0; i < historySize; i++) {
      history.push({ x: width / 2, y: height / 2 });
    }

    const onMouseMove = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      mouse.active = true;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        mouse.x = e.touches[0].clientX;
        mouse.y = e.touches[0].clientY;
        mouse.active = true;
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('touchmove', onTouchMove);

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
    };

    window.addEventListener('resize', resize);

    let animationId: number;
    let time = 0;

      // Extract CSS variables dynamically
      const rootStyle = getComputedStyle(document.documentElement);
      const colorAccent = rootStyle.getPropertyValue('--c-accent').trim() || '#7c6ef5';
      const colorAccent2 = rootStyle.getPropertyValue('--c-accent2').trim() || '#f5a26e';

      const render = () => {
        ctx.clearRect(0, 0, width, height);

        // Shift history
        if (mouse.active) {
          history.shift();
          history.push({ x: mouse.x, y: mouse.y });
        }

        ctx.beginPath();
        if (history.length > 0) {
          ctx.moveTo(history[0].x, history[0].y);

          for (let i = 1; i < history.length - 1; i++) {
            const pt1 = history[i];
            const pt2 = history[i + 1];

            // Ribbon wiggle calculation
            const factor = i / historySize; // 0 to 1
            const wiggle = Math.sin(time + factor * 10) * 15 * factor;
            
            const xc = (pt1.x + pt2.x) / 2 + wiggle;
            const yc = (pt1.y + pt2.y) / 2 - wiggle;

            ctx.quadraticCurveTo(pt1.x, pt1.y, xc, yc);
          }

          const last = history[history.length - 1];
          ctx.lineTo(last.x, last.y);
        }

        ctx.strokeStyle = colorAccent;
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        // Gradient stroke
        if (history.length > 0) {
          const last = history[history.length - 1];
          const first = history[0];
          const gradient = ctx.createLinearGradient(first.x, first.y, last.x, last.y);
          gradient.addColorStop(0, 'transparent');
          gradient.addColorStop(0.5, colorAccent2);
          gradient.addColorStop(1, colorAccent);
          ctx.strokeStyle = gradient;
        }

        ctx.stroke();

        time += 0.1;
        animationId = requestAnimationFrame(render);
      };

    render();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 9999,
      }}
    />
  );
}

const MusicPlayerCommon = (() => {
    const createVisualizationChart = (container) => {
        const canvas = document.createElement('canvas');
        canvas.classList.add('visualization-canvas');
        canvas.style.height = '100px';
        canvas.style.width = '100%';
        container.appendChild(canvas);
        return canvas;
    };

    const createVisualizationController = ({barsCount, maxFps, isPlaying, isHidden}) => {
        let canvas;
        let ctx;
        let analyser;
        let animationFrame;
        let dataArray;
        let resizeObserver;
        let lastFrameTime = 0;
        let cssWidth = 0;
        let cssHeight = 0;
        let deviceScale = 1;
        const minBarValue = 3;
        const frameInterval = 1000 / maxFps;
        const renderedBars = Array(barsCount).fill(minBarValue);
        const targetBars = Array(barsCount).fill(minBarValue);

        const shouldRender = (audioPlayer) => Boolean(
            canvas
            && ctx
            && analyser
            && audioPlayer
            && isPlaying()
            && !audioPlayer.paused
            && !isHidden()
        );

        const syncCanvasSize = () => {
            if (!canvas) return;

            const rect = canvas.getBoundingClientRect();
            const nextWidth = Math.max(1, Math.round(rect.width));
            const nextHeight = Math.max(1, Math.round(rect.height || 100));
            const nextScale = Math.min(window.devicePixelRatio || 1, 2);

            if (nextWidth === cssWidth && nextHeight === cssHeight && nextScale === deviceScale) {
                return;
            }

            cssWidth = nextWidth;
            cssHeight = nextHeight;
            deviceScale = nextScale;
            canvas.width = Math.round(cssWidth * deviceScale);
            canvas.height = Math.round(cssHeight * deviceScale);
            ctx.setTransform(deviceScale, 0, 0, deviceScale, 0, 0);
        };

        const draw = () => {
            if (!ctx || !canvas) return;
            syncCanvasSize();
            ctx.clearRect(0, 0, cssWidth, cssHeight);

            const gap = 4;
            const barWidth = Math.max(3, (cssWidth - gap * (barsCount - 1)) / barsCount);
            const maxBarHeight = Math.max(1, cssHeight - 8);

            for (let i = 0; i < barsCount; i++) {
                const value = renderedBars[i];
                const height = Math.max(3, (value / 100) * maxBarHeight);
                const x = i * (barWidth + gap);
                const y = cssHeight - height;
                const hue = 250 - (value / 100) * 50;

                ctx.fillStyle = `hsl(${hue}, 70%, 60%)`;
                ctx.beginPath();
                roundRect(ctx, x, y, barWidth, height, Math.min(4, barWidth / 2));
                ctx.fill();
            }
        };

        const roundRect = (context, x, y, width, height, radius) => {
            context.moveTo(x + radius, y);
            context.lineTo(x + width - radius, y);
            context.quadraticCurveTo(x + width, y, x + width, y + radius);
            context.lineTo(x + width, y + height - radius);
            context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
            context.lineTo(x + radius, y + height);
            context.quadraticCurveTo(x, y + height, x, y + height - radius);
            context.lineTo(x, y + radius);
            context.quadraticCurveTo(x, y, x + radius, y);
        };

        const updateTargets = () => {
            if (!analyser) return;
            if (!dataArray || dataArray.length !== analyser.frequencyBinCount) {
                dataArray = new Uint8Array(analyser.frequencyBinCount);
            }

            analyser.getByteFrequencyData(dataArray);
            for (let i = 0; i < barsCount; i++) {
                targetBars[i] = Math.min(100, Math.max(minBarValue, dataArray[i] / 2.8));
            }
        };

        const animate = (audioPlayer, timestamp = performance.now()) => {
            if (!shouldRender(audioPlayer)) return;

            if (timestamp - lastFrameTime < frameInterval) {
                animationFrame = requestAnimationFrame((time) => animate(audioPlayer, time));
                return;
            }

            lastFrameTime = timestamp;
            updateTargets();

            let changed = false;

            for (let i = 0; i < barsCount; i++) {
                const next = renderedBars[i] + (targetBars[i] - renderedBars[i]) * 0.35;
                if (Math.abs(next - renderedBars[i]) > 0.1) changed = true;
                renderedBars[i] = next;
            }

            if (changed) draw();
            animationFrame = requestAnimationFrame((time) => animate(audioPlayer, time));
        };

        const resetBars = () => {
            renderedBars.fill(minBarValue);
            targetBars.fill(minBarValue);
            draw();
        };

        const stop = (reset) => {
            if (animationFrame) {
                cancelAnimationFrame(animationFrame);
                animationFrame = null;
            }
            if (reset) resetBars();
        };

        const start = (audioPlayer) => {
            if (!shouldRender(audioPlayer) || animationFrame) return;
            lastFrameTime = 0;
            animationFrame = requestAnimationFrame((time) => animate(audioPlayer, time));
        };

        return {
            setChart(nextCanvas) {
                canvas = nextCanvas;
                ctx = canvas.getContext('2d', {alpha: true});
                dataArray = null;
                renderedBars.fill(minBarValue);
                targetBars.fill(minBarValue);
                syncCanvasSize();
                draw();

                if (resizeObserver) resizeObserver.disconnect();
                resizeObserver = new ResizeObserver(() => {
                    syncCanvasSize();
                    draw();
                });
                resizeObserver.observe(canvas);
            },
            setAnalyser(nextAnalyser) {
                analyser = nextAnalyser;
                dataArray = null;
            },
            start,
            stop,
            destroyChart() {
                stop(false);
                if (resizeObserver) {
                    resizeObserver.disconnect();
                    resizeObserver = null;
                }
                if (canvas) {
                    canvas.remove();
                    canvas = null;
                    ctx = null;
                }
            }
        };
    };

    const createClock = (display, options) => {
        let currentTime = '';
        const update = () => {
            const now = new Date();
            const current = now.toLocaleTimeString([], options);
            if (current !== currentTime || display.textContent === '') {
                display.textContent = current;
                currentTime = current;
            }
        };
        return {update};
    };

    const decodeUTF8Base64 = (base64) => {
        const latin1String = atob(base64);
        const utf8Bytes = Uint8Array.from(latin1String, c => c.charCodeAt(0));
        return new TextDecoder().decode(utf8Bytes);
    };

    return {
        createVisualizationChart,
        createVisualizationController,
        createClock,
        decodeUTF8Base64
    };
})();

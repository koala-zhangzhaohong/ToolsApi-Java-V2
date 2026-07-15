const MusicPlayerCommon = (() => {
    const createVisualizationConfig = (barsCount) => {
        const labels = [];
        const color = [];
        const barsData = [];
        const defaultMin = 3;
        const hue = 250 - (defaultMin / 255) * 50;

        for (let i = 0; i < barsCount; i++) {
            labels.push(String(i));
            color.push(`hsl(${hue}, 70%, 60%)`);
            barsData.push({x: i, y: defaultMin});
        }

        return {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    axis: 'y',
                    data: barsData,
                    fill: false,
                    backgroundColor: color,
                    borderColor: color,
                    borderWidth: 0,
                    barThickness: 4
                }]
            },
            options: {
                animation: false,
                parsing: false,
                responsive: true,
                events: [],
                scales: {
                    y: {min: 0, max: 100, display: false, ticks: {display: false}},
                    x: {display: false, ticks: {display: false}}
                },
                plugins: {
                    legend: {display: false},
                    tooltip: {enabled: false}
                }
            }
        };
    };

    const createVisualizationChart = (container, barsCount) => {
        const canvas = document.createElement('canvas');
        canvas.classList.add('visualization-canvas');
        canvas.style.height = '100px';
        canvas.style.width = '100%';
        container.appendChild(canvas);
        return new Chart(canvas, createVisualizationConfig(barsCount));
    };

    const createVisualizationController = ({barsCount, frameMs, isPlaying, isHidden}) => {
        let chart;
        let analyser;
        let timerId;
        let animationFrame;
        let dataArray;
        const lastRenderedBars = Array(barsCount).fill(3);

        const shouldRender = (audioPlayer) => Boolean(
            chart
            && analyser
            && audioPlayer
            && isPlaying()
            && !audioPlayer.paused
            && !isHidden()
        );

        const resetBars = () => {
            if (!chart) return;
            let changed = false;
            for (let i = 0; i < barsCount; i++) {
                if (lastRenderedBars[i] !== 3) changed = true;
                lastRenderedBars[i] = 3;
                chart.data.datasets[0].data[i] = {x: i, y: 3};
            }
            if (changed) chart.update('none');
        };

        const render = (audioPlayer) => {
            if (!shouldRender(audioPlayer)) return;
            if (!dataArray || dataArray.length !== analyser.frequencyBinCount) {
                dataArray = new Uint8Array(analyser.frequencyBinCount);
            }

            analyser.getByteFrequencyData(dataArray);

            const dataset = chart.data.datasets[0];
            const colors = dataset.backgroundColor;
            let changed = false;

            for (let i = 0; i < barsCount; i++) {
                const value = Math.min(100, Math.max(3, Math.round(dataArray[i] / 3)));
                if (value === lastRenderedBars[i]) continue;

                changed = true;
                lastRenderedBars[i] = value;
                dataset.data[i] = {x: i, y: value};
                colors[i] = `hsl(${250 - (dataArray[i] / 255) * 50}, 70%, 60%)`;
            }

            if (changed) chart.update('none');
        };

        const stop = (reset) => {
            if (timerId) {
                clearInterval(timerId);
                timerId = null;
            }
            if (animationFrame) {
                cancelAnimationFrame(animationFrame);
                animationFrame = null;
            }
            if (reset) resetBars();
        };

        const start = (audioPlayer) => {
            if (!shouldRender(audioPlayer) || timerId) return;
            render(audioPlayer);
            timerId = setInterval(() => {
                if (!shouldRender(audioPlayer)) {
                    stop(false);
                    return;
                }
                animationFrame = requestAnimationFrame(() => render(audioPlayer));
            }, frameMs);
        };

        return {
            setChart(nextChart) {
                chart = nextChart;
                dataArray = null;
                lastRenderedBars.fill(3);
            },
            setAnalyser(nextAnalyser) {
                analyser = nextAnalyser;
                dataArray = null;
            },
            start,
            stop,
            destroyChart() {
                stop(false);
                if (chart) {
                    chart.destroy();
                    chart = null;
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

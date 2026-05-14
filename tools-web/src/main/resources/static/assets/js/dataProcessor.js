// dataProcessor.js
const barsCount = 32;

self.addEventListener('message', function (event) {
    const operation = event.data.operation;

    switch (operation) {
        case 'update':
            break;
        case 'init':
            const labels = [];
            const color = [];
            const barsData = [];
            const defaultMin = 3;
            const hue = 250 - (defaultMin / 255) * 50; // 从紫色到蓝色的渐变

            for (let i = 0; i < barsCount; i++) {
                labels.push(String(i));
                color.push(`hsl(${hue}, 70%, 60%)`);
                barsData.push({x: i, y: defaultMin});
            }

            const data = {
                labels, datasets: [{
                    axis: 'y', data: barsData, fill: false, backgroundColor: color, borderColor: color, borderWidth: 0,     // 设置线条宽度
                    barThickness: 4
                }]
            };

            const config = {
                type: 'bar', // 设置图表类型
                data: data,  // 设置数据集
                options: {
                    parsing: false, responsive: true, hover: {
                        mode: 'nearest', intersect: false
                    }, // 限制每秒执行次数
                    events: ['mousemove', 'mouseout', 'click'], scales: {
                        y: {
                            min: 0, max: 100, display: false, // 隐藏Y轴
                            ticks: {
                                display: false // 隐藏Y轴的刻度
                            }
                        }, x: {
                            display: false, // 隐藏X轴
                            ticks: {
                                display: false // 隐藏X轴的刻度
                            }
                        }
                    }, plugins: {
                        legend: {
                            display: false // 改为 true 显示
                        }, tooltip: {
                            enabled: false // 使用 plugins.tooltip 来禁用提示框
                        }
                    }
                }
            };
            self.postMessage({operation: 'init', config});
            break;
    }
}, false);
const Visualizer = {
    canvas: null,
    ctx: null,
    mode: "waveform", // "waveform" or "spectrum"
    animationId: null,
    running: false,

    // Rainbow colour stops
    RAINBOW: [
        "#ff0000", "#ff4400", "#ff8800", "#ffcc00", "#ffff00",
        "#88ff00", "#00ff00", "#00ff88", "#00ffff", "#0088ff",
        "#0000ff", "#4400ff", "#8800ff", "#cc00ff", "#ff00ff"
    ],

    init() {
        this.canvas = document.getElementById("visualizer-canvas");
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext("2d");

        // Mode toggle buttons
        document.getElementById("viz-waveform").addEventListener("click", () => {
            this.mode = "waveform";
            this.updateButtons();
        });
        document.getElementById("viz-spectrum").addEventListener("click", () => {
            this.mode = "spectrum";
            this.updateButtons();
        });

        this.updateButtons();
        this.resizeCanvas();
        window.addEventListener("resize", () => this.resizeCanvas());

        // Start animation loop (always runs, draws flat line when silent)
        this.start();
    },

    updateButtons() {
        const wBtn = document.getElementById("viz-waveform");
        const sBtn = document.getElementById("viz-spectrum");
        if (wBtn) wBtn.classList.toggle("active", this.mode === "waveform");
        if (sBtn) sBtn.classList.toggle("active", this.mode === "spectrum");
    },

    resizeCanvas() {
        if (!this.canvas) return;
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
    },

    start() {
        if (this.running) return;
        this.running = true;
        this.draw();
    },

    stop() {
        this.running = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    },

    getRainbowColor(fraction) {
        // Map a 0-1 fraction to a smooth rainbow color via HSL
        const hue = fraction * 360;
        return `hsl(${hue}, 100%, 55%)`;
    },

    draw() {
        if (!this.running) return;
        this.animationId = requestAnimationFrame(() => this.draw());

        const { canvas, ctx } = this;
        if (!canvas || !ctx) return;

        const w = canvas.width;
        const h = canvas.height;

        // Dark transparent fade for trail effect
        ctx.fillStyle = "rgba(26, 26, 46, 0.3)";
        ctx.fillRect(0, 0, w, h);

        const analyser = AudioEngine.analyser;
        if (!analyser) {
            this.drawIdleLine(w, h);
            return;
        }

        if (this.mode === "waveform") {
            this.drawWaveform(analyser, w, h);
        } else {
            this.drawSpectrum(analyser, w, h);
        }
    },

    drawIdleLine(w, h) {
        const { ctx } = this;
        ctx.beginPath();
        ctx.strokeStyle = "rgba(233, 69, 96, 0.3)";
        ctx.lineWidth = 2;
        ctx.moveTo(0, h / 2);
        ctx.lineTo(w, h / 2);
        ctx.stroke();
    },

    drawWaveform(analyser, w, h) {
        const { ctx } = this;
        const bufferLength = analyser.fftSize;
        const dataArray = new Float32Array(bufferLength);
        analyser.getFloatTimeDomainData(dataArray);

        const sliceWidth = w / bufferLength;
        const midY = h / 2;

        // Draw glow layer (thicker, more transparent)
        ctx.lineWidth = 6;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        ctx.beginPath();
        let x = 0;
        for (let i = 0; i < bufferLength; i++) {
            const v = dataArray[i];
            const y = midY + v * midY * 0.9;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
            x += sliceWidth;
        }
        const gradient = ctx.createLinearGradient(0, 0, w, 0);
        for (let i = 0; i <= 10; i++) {
            gradient.addColorStop(i / 10, this.getRainbowColor(i / 10));
        }
        ctx.strokeStyle = gradient;
        ctx.globalAlpha = 0.3;
        ctx.stroke();

        // Draw sharp line on top
        ctx.globalAlpha = 1.0;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        x = 0;
        for (let i = 0; i < bufferLength; i++) {
            const v = dataArray[i];
            const y = midY + v * midY * 0.9;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
            x += sliceWidth;
        }
        ctx.strokeStyle = gradient;
        ctx.stroke();

        // Subtle reflection below center
        ctx.globalAlpha = 0.08;
        ctx.lineWidth = 2;
        ctx.beginPath();
        x = 0;
        for (let i = 0; i < bufferLength; i++) {
            const v = dataArray[i];
            const y = midY - v * midY * 0.4 + h * 0.15;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
            x += sliceWidth;
        }
        ctx.strokeStyle = gradient;
        ctx.stroke();
        ctx.globalAlpha = 1.0;
    },

    drawSpectrum(analyser, w, h) {
        const { ctx } = this;
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyser.getByteFrequencyData(dataArray);

        // Only show the lower ~60% of frequency bins (most musical content)
        const usableBins = Math.floor(bufferLength * 0.6);
        const barCount = Math.min(usableBins, Math.floor(w / 3));
        const barWidth = (w / barCount) - 1;
        const binStep = Math.floor(usableBins / barCount);

        for (let i = 0; i < barCount; i++) {
            // Average a few bins for smoother bars
            let sum = 0;
            for (let j = 0; j < binStep; j++) {
                sum += dataArray[i * binStep + j];
            }
            const value = sum / binStep;
            const barHeight = (value / 255) * h * 0.9;
            const x = i * (barWidth + 1);
            const y = h - barHeight;

            const hue = (i / barCount) * 360;

            // Glow
            ctx.fillStyle = `hsla(${hue}, 100%, 55%, 0.15)`;
            ctx.fillRect(x - 1, y - 4, barWidth + 2, barHeight + 8);

            // Bar with gradient
            const barGrad = ctx.createLinearGradient(x, y, x, h);
            barGrad.addColorStop(0, `hsla(${hue}, 100%, 65%, 1)`);
            barGrad.addColorStop(0.5, `hsla(${hue}, 100%, 50%, 0.9)`);
            barGrad.addColorStop(1, `hsla(${hue}, 100%, 30%, 0.7)`);
            ctx.fillStyle = barGrad;
            ctx.fillRect(x, y, barWidth, barHeight);

            // Bright cap on top
            if (barHeight > 2) {
                ctx.fillStyle = `hsla(${hue}, 100%, 80%, 1)`;
                ctx.fillRect(x, y, barWidth, 2);
            }
        }
    }
};

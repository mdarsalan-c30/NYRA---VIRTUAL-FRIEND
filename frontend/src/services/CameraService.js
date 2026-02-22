export class CameraService {
    constructor() {
        this.stream = null;
    }

    async startCamera() {
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "user" },
                audio: false
            });
            return this.stream;
        } catch (error) {
            console.error("Camera Access Error:", error);
            throw error;
        }
    }

    stopCamera() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
    }

    takeSnapshot(videoElement) {
        if (!videoElement) return null;

        const canvas = document.createElement('canvas');
        canvas.width = videoElement.videoWidth;
        canvas.height = videoElement.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

        // Return as base64 jpeg
        return canvas.toDataURL('image/jpeg', 0.8);
    }
}

export const cameraService = new CameraService();

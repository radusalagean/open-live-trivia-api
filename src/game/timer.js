module.exports = class Timer {
    constructor(runnable, timeout) {
        this.runnable = runnable
        this.timeout = timeout
        this.start()
    }

    start() {
        this.interval = setInterval(this.runnable, this.timeout)
        this.startTime = new Date()
    }

    getElapsedSeconds() {
        return Math.floor((new Date().getTime() - this.startTime.getTime()) / 1000)
    }

    stop() {
        clearInterval(this.interval)
        this.interval = undefined
        this.startTime = undefined
    }
}
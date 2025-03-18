import { io, Socket } from "socket.io-client";

// Global variables
let roomName: string = "";
let drawings: line[][] = [];
let undoStack: line[][] = [];
let leftMouseDown: boolean = false;
let rightMouseDown: boolean = false;
let currentStroke: line[] = [];
let cursorX: number, cursorY: number, prevCursorX: number, prevCursorY: number;
let offsetX: number = 0, offsetY: number = 0;
let scale: number = 1;

type line = { x0: number, y0: number, x1: number, y1: number };

async function getRoomName(url: string): Promise<{ roomName?: string }> {
    try {
        const response = await fetch(url);
        if (!response.ok){
            throw new Error(`HTTP error! status: ${response.status}`);
        } 
        return await response.json();
    } catch (error) {
        console.error("Error fetching room name:", error);
        return {};
    }
}

async function initApp() {
    const config = await getRoomName("http://localhost:5000/config");
    if (!config.roomName) {
        console.error("No roomName received from server.");
        return;
    }
    roomName = config.roomName;
    console.log("Using roomName:", roomName);

    // Step 1: Setup socket AFTER getting roomName
    const socket = io('http://localhost:5000');

    // Step 2: Setup canvas AFTER ready
    const canvas = document.getElementById("canvas") as HTMLCanvasElement | null;
    if (!canvas) {
        throw new Error("Canvas element not found");
    }
    const context = canvas.getContext("2d");
    if (!context) {
        throw new Error("2D context not available");
    }

    // Step 3: Setup canvas listeners
    setupCanvasListeners(canvas, context, socket);

    // Step 4: Setup socket listeners
    socket.on('connect', () => {
        socket.emit('join_room', { room: roomName, drawings });
    });

    socket.on('drawing', (receivedDrawings) => {
        if (Array.isArray(receivedDrawings)) {
            drawings = JSON.parse(JSON.stringify(receivedDrawings));
            redrawCanvas(canvas, context);
        }
    });

    socket.on('new connections established', (receivedDrawings) => {
        if (Array.isArray(receivedDrawings)) {
            drawings = JSON.parse(JSON.stringify(receivedDrawings));
            redrawCanvas(canvas, context);
        }
    });

    redrawCanvas(canvas, context);
    console.log("App ready, drawing enabled!");
}

// ---- Canvas Event Listeners ----
function setupCanvasListeners(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D, socket: Socket) {
    document.oncontextmenu = () => false;
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mouseup', (event) => onMouseUp(event, canvas, context, socket));
    canvas.addEventListener('mousemove', (event)=> onMouseMove(event, canvas, context));
    canvas.addEventListener('wheel',  (event)=> onMouseWheel(event, canvas, context));

    document.addEventListener('keydown', (event) => {
        if (event.ctrlKey && event.key === 'z') {
            event.preventDefault();
            undo(canvas, context, socket);
        }
        if (event.ctrlKey && event.key === 'y') {
            event.preventDefault();
            redo(canvas, context, socket);
        }
    });
}

function onMouseDown(event: MouseEvent) {
    if (event.button === 0) {
        leftMouseDown = true;
        currentStroke = [];
    }
    if (event.button === 2) {
        rightMouseDown = true;
    }
    cursorX = event.pageX;
    cursorY = event.pageY;
    prevCursorX = cursorX;
    prevCursorY = cursorY;
}

function onMouseMove(event: MouseEvent, canvas: HTMLCanvasElement, context: CanvasRenderingContext2D) {
    cursorX = event.pageX;
    cursorY = event.pageY;
    const scaledX = toTrueX(cursorX);
    const scaledY = toTrueY(cursorY);
    const prevScaledX = toTrueX(prevCursorX);
    const prevScaledY = toTrueY(prevCursorY);

    if (leftMouseDown) {
        let curline: line = {
            x0: prevScaledX, y0: prevScaledY, x1: scaledX, y1: scaledY
        }
        currentStroke.push(curline);
        drawLine(curline, context);
    }

    if (rightMouseDown) {
        offsetX += (cursorX - prevCursorX) / scale;
        offsetY += (cursorY - prevCursorY) / scale;
        redrawCanvas(canvas, context);
    }

    prevCursorX = cursorX;
    prevCursorY = cursorY;
}

function onMouseUp(event: MouseEvent, canvas:HTMLCanvasElement, context:CanvasRenderingContext2D, socket: Socket){
    leftMouseDown = false;
    rightMouseDown = false;
    if (currentStroke.length > 0) {
        drawings.push([...currentStroke]);
        emitDrawingMessages(socket);
        redrawCanvas(canvas, context);
    }
}

function onMouseWheel(event: WheelEvent, canvas: HTMLCanvasElement, context:CanvasRenderingContext2D) {
    const scaleAmount = -event.deltaY / 500;
    scale *= (1 + scaleAmount);

    const distX = event.pageX / canvas.clientWidth;
    const distY = event.pageY / canvas.clientHeight;

    const unitsZoomedX = canvas.clientWidth * scaleAmount;
    const unitsZoomedY = canvas.clientHeight * scaleAmount;

    offsetX -= unitsZoomedX * distX;
    offsetY -= unitsZoomedY * distY;

    redrawCanvas(canvas, context);
}

function redrawCanvas(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D) {
    canvas.width = document.body.clientWidth;
    canvas.height = document.body.clientHeight;
    context.fillStyle = '#000';
    context.fillRect(0, 0, canvas.width, canvas.height);

    drawings.forEach(stroke => {
        stroke.forEach(line => {
            drawLine(line, context);
        });
    });
}

function drawLine(line: line, context:CanvasRenderingContext2D) {
    context.beginPath();
    context.moveTo(toScreenX(line.x0), toScreenY(line.y0));
    context.lineTo(toScreenX(line.x1), toScreenY(line.y1));
    context.strokeStyle = '#00FF00';
    context.lineWidth = 2;
    context.stroke();
}

function emitDrawingMessages(socket: Socket) {
    socket.emit('drawings have been changed', { room: roomName, drawings });
}

function undo(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D, socket: any) {
    if (drawings.length > 0) {
        let stroke = drawings.pop();
        if (stroke) undoStack.push(stroke);
        emitDrawingMessages(socket);
        redrawCanvas(canvas, context);
    }
}

function redo(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D, socket: any) {
    if (undoStack.length > 0) {
        let stroke = undoStack.pop();
        if (stroke) drawings.push(stroke);
        emitDrawingMessages(socket);
        redrawCanvas(canvas, context);
    }
}

function toScreenX(xTrue: number): number { return (xTrue + offsetX) * scale; }
function toScreenY(yTrue: number): number { return (yTrue + offsetY) * scale; }
function toTrueX(xScreen: number): number { return (xScreen / scale) - offsetX; }
function toTrueY(yScreen: number): number { return (yScreen / scale) - offsetY; }

initApp();

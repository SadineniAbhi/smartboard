// Get canvas element
import { io } from "socket.io-client";
let roomName = prompt("Enter Room Name:");
const canvas = document.getElementById("canvas") as HTMLCanvasElement | null;
const socket = io('http://localhost:5000');
if (!canvas) {
  throw new Error("Canvas element not found");
}

const context = canvas.getContext("2d");
if (!context) {
  throw new Error("2D context not available");
}

type line = {
    x0 : number,
    y0 : number, 
    x1 : number, 
    y1 : number
}

// Disable right-click context menu
document.oncontextmenu = () => false;

canvas.addEventListener('mousedown', onMouseDown);
canvas.addEventListener('mouseup', onMouseUp);
canvas.addEventListener('mousemove', onMouseMove);
canvas.addEventListener('wheel', onMouseWheel);

let leftMouseDown: boolean = false;
let rightMouseDown: boolean = false;
let currentStroke: line[] = [];
let drawings: line[][] = [];
let cursorX: number, cursorY: number, prevCursorX: number, prevCursorY: number;
let offsetX: number = 0, offsetY: number = 0;
let scale: number = 1;



function toScreenX(xTrue: number) : number { 
    return (xTrue + offsetX) * scale; 
}
function toScreenY(yTrue: number) : number {
     return (yTrue + offsetY) * scale; 
}
function toTrueX(xScreen: number) : number { 
    return (xScreen / scale) - offsetX; 
}
function toTrueY(yScreen: number) : number { 
    return (yScreen / scale) - offsetY; 
}


function redrawCanvas() {
    if (!context) {
        throw new Error("2D context not available");
    }

    if (!canvas) {
        throw new Error("Canvas element not found");
    }

    canvas.width  = document.body.clientWidth;
    canvas.height = document.body.clientHeight;
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);

    // Redraw all stored strokes
    drawings.forEach(stroke => {
        stroke.forEach(line => {
            drawLine(line);
        });
    });
}

redrawCanvas();

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

function onMouseMove(event: MouseEvent) {
    cursorX = event.pageX;
    cursorY = event.pageY;
    const scaledX = toTrueX(cursorX);
    const scaledY = toTrueY(cursorY);
    const prevScaledX = toTrueX(prevCursorX);
    const prevScaledY = toTrueY(prevCursorY);

    if (leftMouseDown) {
        let curline : line = {
            x0: prevScaledX, y0: prevScaledY, x1: scaledX, y1: scaledY
        }
        currentStroke.push(curline);
        drawLine(curline);
    }

    if (rightMouseDown) {
        offsetX += (cursorX - prevCursorX) / scale;
        offsetY += (cursorY - prevCursorY) / scale;
        redrawCanvas();
    }

    prevCursorX = cursorX;
    prevCursorY = cursorY;
}

function onMouseUp() {
    leftMouseDown = false;
    rightMouseDown = false;
    if (currentStroke.length > 0) {
        drawings.push([...currentStroke]);
        emitDrawingMessages(drawings);
    }
}

function onMouseWheel(event: WheelEvent) {
    if (!canvas) {
        throw new Error("context element not found");
    }
    const scaleAmount = -event.deltaY / 500;
    scale *= (1 + scaleAmount);

    const distX = event.pageX / canvas.clientWidth;
    const distY = event.pageY / canvas.clientHeight;

    const unitsZoomedX = canvas.clientWidth * scaleAmount;
    const unitsZoomedY = canvas.clientHeight * scaleAmount;

    offsetX -= unitsZoomedX * distX;
    offsetY -= unitsZoomedY * distY;

    redrawCanvas();
}

function drawLine(line: line) {
    //TODO what does the beginpath function do?
    if (!context) {
        throw new Error("context element not found");
    }
    context.beginPath();
    context.moveTo(toScreenX(line.x0), toScreenY(line.y0));
    context.lineTo(toScreenX(line.x1), toScreenY(line.y1));
    context.strokeStyle = '#00FF00';
    context.lineWidth = 2;
    context.stroke();
}

socket.on('connect', () => {
    socket.emit('join_room', { room: roomName });
});

socket.on('drawing', function(receivedDrawings) {
    console.log('New drawings received:', receivedDrawings);

    if (Array.isArray(receivedDrawings)) {
        drawings = JSON.parse(JSON.stringify(receivedDrawings)); // Deep copy
        redrawCanvas();
    }
});

function emitDrawingMessages(drawings: line[][]) {
    socket.emit('drawings have been changed', {room : roomName, drawings: drawings});
}

socket.on('new connections established', function(receivedDrawings) {
    console.log('New drawings received:', receivedDrawings);

    if (Array.isArray(receivedDrawings)) {
        drawings = JSON.parse(JSON.stringify(receivedDrawings)); // Deep copy
        redrawCanvas();
    }
});

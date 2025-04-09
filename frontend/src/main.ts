import { io, Socket } from "socket.io-client";

declare global {
    interface Window {
        roomName: string;
        userName: string;
        roomOwner: string;
    }
}

type line = { x0: number, y0: number, x1: number, y1: number };
interface Drawings {
    [user: string]: line[][];
}
let roomName: string = window.roomName;
let userName: string = window.userName;
let drawings: Drawings = {}; // {user: [[line1, line2, ...], [line1, line2, ...]]}
let undoStack: Drawings = {}; // {user: [[line1, line2, ...], [line1, line2, ...]]}
let leftMouseDown: boolean = false;
let rightMouseDown: boolean = false;
let currentStroke: line[] = [];
let cursorX: number, cursorY: number, prevCursorX: number, prevCursorY: number;
let offsetX: number = 0, offsetY: number = 0;
let scale: number = 1;
let count: number = 0;

if (drawings[userName] === undefined) {
    drawings[userName] = [];
}

function initAppWithRoom(room: string) {
    roomName = room;
    console.log("Using roomName:", roomName);
    const socket = io();
    const canvas = document.getElementById("canvas") as HTMLCanvasElement | null;
    if (!canvas) throw new Error("Canvas element not found");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("2D context not available");
    canvas.style.display = "block"; 
    setupCanvasListeners(canvas, context, socket);
    socket.emit('join', { room: roomName });
    socket.on('send_all_drawings', () => {
        if (window.roomOwner == 'yes') {
            socket.emit("all_drawings", { room: roomName, drawings: drawings });
        }
    });
    socket.on('strokes', (receivedStrokes) => {
        if (typeof receivedStrokes === 'object' && receivedStrokes !== null) {
            if (drawings[receivedStrokes.user_name] === undefined) {
                drawings[receivedStrokes.user_name] = []
            }
            drawings[receivedStrokes.user_name].push(JSON.parse(JSON.stringify(receivedStrokes.new_strokes)));
            redrawCanvas(canvas, context);
        }
    });
    socket.on('current_drawings', (receivedDrawings) => {
        drawings = receivedDrawings;
        redrawCanvas(canvas, context);
    });

    socket.on("undo", (data) => {
        let targetUser = data.userName;
        if (drawings[targetUser] && drawings[targetUser].length > 0) {
            undo(canvas, context, targetUser);
        }
    });
    
    socket.on("redo", (data) => {
        let targetUser = data.userName;
        if (undoStack[targetUser] && undoStack[targetUser].length > 0) {
            redo(canvas, context, targetUser);
        }
    });
        
    redrawCanvas(canvas, context);
    console.log("App ready, drawing enabled!");
}

function setupCanvasListeners(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D, socket: Socket) {
    document.oncontextmenu = () => false;
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mouseup', (event) => onMouseUp(event, canvas, context, socket));
    canvas.addEventListener('mousemove', (event)=> onMouseMove(event, canvas, context));
    canvas.addEventListener('wheel',  (event)=> onMouseWheel(event, canvas, context));

    document.addEventListener('keydown', (event) => {
        if (event.ctrlKey && event.key === 'z') {
            event.preventDefault();
            socket.emit("undo", { room : roomName, userName: userName})
            undo(canvas, context, userName);
        }
        if (event.ctrlKey && event.key === 'y') {
            event.preventDefault();
            socket.emit("redo", { room : roomName, userName: userName})
            redo(canvas, context, userName);
        }
    });
    document.getElementById('undo')?.addEventListener('click', () => {
        socket.emit("undo", { room : roomName, userName: userName})
        undo(canvas, context, userName);
    });
    document.getElementById('redo')?.addEventListener('click', () => {
        socket.emit("redo", { room : roomName, userName: userName})
        redo(canvas, context, userName);
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
        if (drawings[userName] === undefined) {
            drawings[userName] = [];
        }
        count += currentStroke.length;
        console.log(count);
        drawings[userName].push([...currentStroke]);
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

    for (const user in drawings) {
        drawings[user].forEach((stroke: line[]) => {
            stroke.forEach((line: line) => {
                drawLine(line, context);
            });
        });
    }
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
    socket.emit('new-strokes', { room: roomName, userName: userName, strokes: currentStroke });
}

function undo(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D, userName: string) {
    console.log("hellow");
    if (!undoStack[userName]) undoStack[userName] = [];
    if (drawings[userName] && drawings[userName].length > 0) {
        let stroke = drawings[userName].pop();
        if (stroke) undoStack[userName].push(stroke);
        redrawCanvas(canvas, context);
    }
}

function redo(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D, userName: string) {
    if (!undoStack[userName]) undoStack[userName] = [];
    if (undoStack[userName] && undoStack[userName].length > 0) {
        let stroke = undoStack[userName].pop();
        if (stroke) drawings[userName].push(stroke);
        redrawCanvas(canvas, context);
    }
}

function toScreenX(xTrue: number): number { return (xTrue + offsetX) * scale; }
function toScreenY(yTrue: number): number { return (yTrue + offsetY) * scale; }
function toTrueX(xScreen: number): number { return (xScreen / scale) - offsetX; }
function toTrueY(yScreen: number): number { return (yScreen / scale) - offsetY; }

function downloadBoard() {
    const canvas = document.getElementById("canvas") as HTMLCanvasElement;
    if (!canvas) return;
    
    // Store current scale and offset
    const originalScale = scale;
    const originalOffsetX = offsetX;
    const originalOffsetY = offsetY;
    
    // Calculate bounds of all drawings
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    for (const user in drawings) {
        drawings[user].forEach((stroke: line[]) => {
            stroke.forEach((line: line) => {
                minX = Math.min(minX, line.x0, line.x1);
                minY = Math.min(minY, line.y0, line.y1);
                maxX = Math.max(maxX, line.x0, line.x1);
                maxY = Math.max(maxY, line.y0, line.y1);
            });
        });
    }
    
    // If no drawings exist, use default bounds
    if (minX === Infinity) {
        minX = -1000;
        minY = -1000;
        maxX = 1000;
        maxY = 1000;
    }
    
    // Add some padding
    const padding = 50;
    minX -= padding;
    minY -= padding;
    maxX += padding;
    maxY += padding;
    
    // Calculate new scale and offset to fit all drawings
    const width = maxX - minX;
    const height = maxY - minY;
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    
    // Calculate scale to fit both width and height
    const scaleX = canvasWidth / width;
    const scaleY = canvasHeight / height;
    scale = Math.min(scaleX, scaleY) * 0.9; // 0.9 to add some margin
    
    // Center the content
    offsetX = -minX + (canvasWidth / scale - width) / 2;
    offsetY = -minY + (canvasHeight / scale - height) / 2;
    
    // Redraw canvas with new scale and offset
    const context = canvas.getContext('2d');
    if (!context) return;
    redrawCanvas(canvas, context);
    
    // Create a temporary canvas to capture the entire content
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;
    
    // Set the temporary canvas size to match the screen
    tempCanvas.width = canvasWidth;
    tempCanvas.height = canvasHeight;
    
    // Fill with white background
    tempCtx.fillStyle = 'white';
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
    
    // Draw the main canvas content
    tempCtx.drawImage(canvas, 0, 0);
    
    // Convert to image and download
    const image = tempCanvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = image;
    link.download = `${roomName}.png`;
    link.click();
    
    // Restore original scale and offset
    scale = originalScale;
    offsetX = originalOffsetX;
    offsetY = originalOffsetY;
    redrawCanvas(canvas, context);
}

// Add event listener for the download button
document.getElementById('download')?.addEventListener('click', downloadBoard);

initAppWithRoom(roomName);

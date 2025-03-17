from flask import Flask, send_from_directory
from flask_socketio import SocketIO, emit, join_room
from collections import defaultdict
from db import collection

app = Flask(__name__, static_folder='static', template_folder='templates')
socketio = SocketIO(app, cors_allowed_origins="*")
drawings_dict = defaultdict(list)

@app.route('/')
def index():
    return send_from_directory('templates', 'index.html')

@socketio.on('join_room')
def handle_connections(data):
    global drawings_dict
    room = data.get('room')
    join_room(room)
    doc = collection.find_one({"room": room})
    room_drawings = doc["drawings"] if doc else []
    #emit("drawing", drawings_dict[room])
    emit("drawing", room_drawings)

@socketio.on('drawings have been changed')
def handle_drawing(data):
    global drawings_dict
    room = data.get('room')
    drawings = data.get('drawings')
    collection.update_one(
    {"room": room},
    {"$set": {"drawings": drawings}},
    upsert=True
    )
    drawings_dict[room] = drawings.copy()
    emit('drawing', drawings, to=room, include_self=False)

@app.route('/static/<path:filename>')
def assets(filename):
    return send_from_directory('static', filename)



if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', debug=True)

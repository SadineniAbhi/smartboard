from flask import Flask, render_template
from flask_socketio import SocketIO, emit, join_room
from collections import defaultdict

app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*")
drawings_dict = defaultdict(list)

@app.route('/')
def index():
    return render_template('index.html')

@socketio.on('join_room')
def handle_connections(data):
    global drawings_dict
    room = data.get('room')
    join_room(room)
    emit("drawing", drawings_dict[room])

@socketio.on('drawings have been changed')
def handle_drawing(data):
    global drawings_dict
    room = data.get('room')
    drawings = data.get('drawings')
    drawings_dict[room] = drawings.copy()
    print("Received drawing data:", drawings)
    emit('drawing', drawings, to=room, include_self=False)



if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', debug=True)

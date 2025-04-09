from flask import Flask, render_template, request, jsonify, redirect, url_for
from flask_socketio import SocketIO, emit, join_room

app = Flask(__name__, static_folder='static', template_folder='templates')
socketio = SocketIO(app, cors_allowed_origins="*")

@app.route("/", methods=['GET', 'POST'])
def landingpage():
    if request.method == 'POST':
        username = request.form['username']
        roomname = request.form['roomname']
        return redirect(url_for('main', username=username, roomname=roomname, roomOwner="yes"))
    return render_template('landingpage.html')

@app.route("/main/<username>/<roomname>/<roomOwner>")
def main(username, roomname, roomOwner):
    return render_template('index.html', username=username, roomname=roomname, roomOwner=roomOwner)

@app.route("/main/<roomname>", methods=['GET', 'POST'])
def userregister(roomname):
    if request.method == 'POST':
        username = request.form['username']
        return redirect(url_for('main', username=username, roomname=roomname, roomOwner="no"))
    return render_template('userregister.html')


@socketio.on('join')
def on_join(data):
    room = data['room']
    join_room(room)
    emit('send_all_drawings', to=room)

@socketio.on('all_drawings')
def on_all_drawings(data):
    room = data['room']
    drawings = data['drawings']
    emit('current_drawings', drawings, to=room)

@socketio.on("undo")
def undo(data):
    roomName = data['room']
    emit('undo', data, to=roomName, include_self=False)

@socketio.on("redo")
def undo(data):
    roomName = data['room']
    emit('redo', data, to=roomName, include_self=False)

@socketio.on('new-strokes')
def handle_drawing(data):
    room = data.get('room')
    username = data.get('userName')
    new_strokes = data.get('strokes')
    emit('strokes', {'user_name': username, 'new_strokes': new_strokes}, to=room, include_self=False)


if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=8080, debug=True)


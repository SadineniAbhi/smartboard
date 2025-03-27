from pymongo.mongo_client import MongoClient
from urllib.parse import quote_plus

username = "sadineniabhi"
password = quote_plus("Venkanna@9")  # Escapes the '@' symbol

# Construct the URI using the escaped password
uri = f"mongodb://{username}:{password}@ac-qmcaxdu-shard-00-00.nmubbyu.mongodb.net:27017," \
      f"ac-qmcaxdu-shard-00-01.nmubbyu.mongodb.net:27017," \
      f"ac-qmcaxdu-shard-00-02.nmubbyu.mongodb.net:27017/" \
      f"?ssl=true&replicaSet=atlas-av4w2f-shard-0&authSource=admin&retryWrites=true&w=majority&appName=Cluster0"

# Create a new client and connect to the server
client = MongoClient(uri)

db = client["smartboard_db"]
collection = db["drawings"]

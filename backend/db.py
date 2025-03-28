from pymongo.mongo_client import MongoClient

uri = "mongodb://abhi2:abhi2@ac-kds5qtp-shard-00-00.ein2vfa.mongodb.net:27017,ac-kds5qtp-shard-00-01.ein2vfa.mongodb.net:27017,ac-kds5qtp-shard-00-02.ein2vfa.mongodb.net:27017/?ssl=true&replicaSet=atlas-7cuyex-shard-0&authSource=admin&retryWrites=true&w=majority&appName=Cluster0"

# Create a new client and connect to the server
client = MongoClient(uri)

db = client["smartboard_db"]
collection = db["drawings"]

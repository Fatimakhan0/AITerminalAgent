import random
import string
import sys

def generate_password(length):
    password = ''.join(random.choice(string.ascii_letters + string.digits) for _ in range(length))
    return password

# default length
length = 12

# check if user passed argument
if len(sys.argv) > 1:
    length = int(sys.argv[1])

print("Generated Password:", generate_password(length))
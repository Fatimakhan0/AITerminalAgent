import requests
from bs4 import BeautifulSoup

# URL to scrape
url = "https://www.example.com"

# Send request and get HTML response
response = requests.get(url)

# Parse HTML content using BeautifulSoup
soup = BeautifulSoup(response.content, 'html.parser')

# Find the specific data you want to scrape
data = soup.find('div', {'class': 'data-container'}).text

# Print the scraped data
print(data)

# You can also use this code to scrape multiple pages
for page in range(1, 11):
    page_url = f"https://www.example.com/page/{page}"
    response = requests.get(page_url)
    soup = BeautifulSoup(response.content, 'html.parser')
    data = soup.find('div', {'class': 'data-container'}).text
    print(data)
import requests
from bs4 import BeautifulSoup
import json
from datetime import datetime
import time

def fetch_page(url):
    response = requests.get(url)
    # Check if the page was successfully retrieved
    if response.status_code == 200:
        return BeautifulSoup(response.text, 'lxml')
    else:
        return None

def validate_structure(soup):
    # Example checks for expected patterns
    if soup and not soup.find_all(class_='mve-sec1 evnt-sec1'):
        print("Warning: Expected structure has changed.")
        return False
    return True

def scrape_events_page(page_url):
    soup = fetch_page(page_url)

    if soup is None:
        print(f"Failed to fetch data from {page_url}.")
        return []

    if not validate_structure(soup):
        print("The website structure has changed. Please update the scraper accordingly.")
        return []

    events = soup.find_all("div", class_="mve-sec1 evnt-sec1")
    events_data = []
    try:
        for i in range(len(events)):
            event_page = events[i].find('figure').find('a')['href']
            page = fetch_page(page_url+event_page)        
            e = page.find("div", class_="inr-sec1-det-rgt")
            title = e.find('h1').text
            # print(title)
            description = page.find("div", class_="row").find_all('p')[0].text.strip()
            location = page.find("div", class_="mve-cat").find('ul').find_all('li')[2].text.strip()
            date = page.find("div", class_="mve-cat").find('ul').find_all('li')[0].text.replace("to", "-")
            time = page.find("div", class_="mve-cat").find('ul').find_all('li')[1].text
            image = events[i].find("div", class_="mve-sec1-img").find('img')['src']
           
            events_data.append({
                'name': title,
                'image': image,
                'location': location,
                'description': description,
                'date': date,
                'time': time,
                'category': 'Other',
            }) 
       
    except:
        print("done")    
    
    return events_data

def scrape_all_events(base_url):
    all_events = []
    page_url = f"{base_url}"
    print(f"Scraping data")
    page_data = scrape_events_page(page_url)
    for event in page_data:
        all_events.append(event)
    time.sleep(1)  # Be respectful and avoid hammering the server

    return all_events

def get_events():
    BASE_URL = 'https://events.q-tickets.com'
    events = scrape_all_events(BASE_URL)
    return events

if __name__ == "__main__":
    events = get_events()

    # BASE_URL = 'https://events.q-tickets.com'
    # events = scrape_all_events(BASE_URL)
    # with open('events_data.json', 'r', encoding='utf-8') as file:
    #     existing_data = json.load(file)
    
    # existing_data.extend(events)

    # with open('events_data.json', 'w', encoding='utf-8') as f:
    #     json.dump(existing_data, f, indent=4, ensure_ascii=False)


    print(f"Total events scraped: {len(events)}")

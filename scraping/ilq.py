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
    if soup and not soup.find_all(class_='article-block _events'):
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

    events = soup.find_all("div", class_="article-block _events")
    events_data = []
        
    for event in events:
        title = event.find("a", class_="article-block__title").text
        description = event.find("div", class_="article-block__text").text
        location = event.find("div", class_="top-slider-content-event__item _place").text.strip()
        date = event.find("div", class_="top-slider-content-event__item _date").text.strip().replace("\n", " ")
        time = event.find("div", class_="top-slider-content-event__item _time").text.strip().replace("\n", " ")
        image_tag = event.find("a", class_="article-block__image")
        event_ended = image_tag.find_all("div")
        event_status = event_ended[1].text if len(event_ended) > 0 else "Not Ended"
        image = image_tag.find('img')['src']
        category_tag = event.find('div', class_='article-block-bread').find_all('a')
        category = category_tag[1].text.strip() if len(category_tag) > 1 else "Other"      
        
        events_data.append({
            'name': title,
            'image': image,
            'location': location,
            'description': description,
            'date': date,
            'time': time,
            'category': category,
            'ended': event_status,
        })

    return events_data

def scrape_all_events(base_url):
    all_events = []
    current_page = 1
    while current_page < 11:
        page_url = f"{base_url}/p{current_page}"
        print(f"Scraping {page_url}")
        page_data = scrape_events_page(page_url)        
        
        for event in page_data:
            if event['ended'] == "Ended":
                return all_events
            event.pop("ended", None)
            all_events.append(event)

        current_page += 1
        time.sleep(1)  # Be respectful and avoid hammering the server

    return all_events

def get_events():
    BASE_URL = 'https://www.iloveqatar.net/events'
    events = scrape_all_events(BASE_URL)
    return events

if __name__ == "__main__":
    events = get_events()

    # BASE_URL = 'https://www.iloveqatar.net/events'
    # events = scrape_all_events(BASE_URL)
    
       
    #  with open('events_data.json', 'w', encoding='utf-8') as f:
    #      json.dump(events, f, indent=4, ensure_ascii=False)

    
    print(f"Total events scraped: {len(events)}")

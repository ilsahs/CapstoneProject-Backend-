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

def format_date(date_str):
    date_str = date_str.strip()
    # Check if the date string contains the expected format
    if " - " not in date_str:
        date_obj = datetime.strptime(date_str, "%d-%m-%Y")
        # Format the datetime object to the desired format
        formatted_date = date_obj.strftime("%d %B %Y")
        print(formatted_date)

    else:  
        # Split the date string into start and end dates
        start_date_str, end_date_str = date_str.split(" - ")
        # Split each date into day, month, and year
        start_day, start_month, start_year = start_date_str.split("-")
        end_day, end_month, end_year = end_date_str.split("-")
        # Create a dictionary to map month numbers to month names
        month_names = {
            "01": "January", "02": "February", "03": "March", "04": "April",
            "05": "May", "06": "June", "07": "July", "08": "August",
            "09": "September", "10": "October", "11": "November", "12": "December"
        }
        # Format start and end dates
        formatted_start_date = f"{int(start_day)} {month_names[start_month]} {start_year}"
        formatted_end_date = f"{int(end_day)} {month_names[end_month]} {end_year}"
        # Construct the final date string
        formatted_date = f"{formatted_start_date} - {formatted_end_date}"
        print(formatted_date)

    
    return formatted_date


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
            date_str = page.find("div", class_="mve-cat").find('ul').find_all('li')[0].text.replace("to", "-")
            date_str = date_str.strip()

            # Format date string
            print(date_str)
            date = format_date(date_str)
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
                   
    except Exception as e:
        print(e)    
    
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

FROM hotel-agent-backend:window-identity-claude-20261026
COPY backend/src/hotel_agent/adapters/geo/geographic_objects.py /srv/src/hotel_agent/adapters/geo/geographic_objects.py
COPY backend/src/hotel_agent/adapters/geo/osm_geometry.py /srv/src/hotel_agent/adapters/geo/osm_geometry.py
COPY backend/src/hotel_agent/adapters/llm/chat_dialogue.py /srv/src/hotel_agent/adapters/llm/chat_dialogue.py
COPY backend/src/hotel_agent/adapters/llm/prompts.py /srv/src/hotel_agent/adapters/llm/prompts.py
COPY backend/src/hotel_agent/application/agent/requested_tools.py /srv/src/hotel_agent/application/agent/requested_tools.py
COPY backend/src/hotel_agent/application/geographic_distance.py /srv/src/hotel_agent/application/geographic_distance.py
COPY backend/src/hotel_agent/application/landmark_resolution.py /srv/src/hotel_agent/application/landmark_resolution.py
COPY backend/src/hotel_agent/application/ports/geographic_objects.py /srv/src/hotel_agent/application/ports/geographic_objects.py
COPY backend/src/hotel_agent/application/search_candidates.py /srv/src/hotel_agent/application/search_candidates.py
COPY backend/src/hotel_agent/application/use_cases/search_hotels.py /srv/src/hotel_agent/application/use_cases/search_hotels.py
COPY backend/src/hotel_agent/main.py /srv/src/hotel_agent/main.py

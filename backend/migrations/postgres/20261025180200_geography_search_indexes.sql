-- migrate:up
CREATE INDEX buildings_footprint_geography_gist ON buildings USING gist ((footprint::geography));
CREATE INDEX hotels_location_geography_gist ON hotels USING gist ((location::geography));
CREATE INDEX pois_location_geography_gist ON pois USING gist ((location::geography));
CREATE INDEX coastline_geometry_geography_gist ON coastline USING gist ((geometry::geography));
CREATE INDEX beaches_geometry_geography_gist ON beaches USING gist ((geometry::geography));
CREATE INDEX noise_sources_geometry_geography_gist ON noise_sources USING gist ((geometry::geography));

-- migrate:down
DROP INDEX noise_sources_geometry_geography_gist;
DROP INDEX beaches_geometry_geography_gist;
DROP INDEX coastline_geometry_geography_gist;
DROP INDEX pois_location_geography_gist;
DROP INDEX hotels_location_geography_gist;
DROP INDEX buildings_footprint_geography_gist;

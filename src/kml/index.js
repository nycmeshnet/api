import { networkLink } from "./utils";

export function getKML() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:gx="http://www.google.com/kml/ext/2.2" xmlns:kml="http://www.opengis.net/kml/2.2" xmlns:atom="http://www.w3.org/2005/Atom">
<Document>
	<name>NYC Mesh API</name>
	${networkLink("Appointments", "/v1/kml/appointments")}
	${networkLink("LoS", "/v1/kml/los")}
	${networkLink("Nodes", "/v1/kml/nodes")}
	${networkLink("Requests", "/v1/kml/requests")}
</Document>
</kml>
`;
}

import { WebClient } from "@slack/web-api";
import { format } from "date-fns";

const slack = new WebClient(process.env.SLACK_TOKEN);

const requestChannel   = "join-requests-test";
const panoChannel = "panoramas-test";
const installChannel = "install-team-test";

const dateFmtString = "EEEE, MMM d h:mm aa";

export async function requestMessage(request, building, member, visibleNodes) {
	return sendMessage(requestChannel, requestMessageContent(request, building, member, visibleNodes));
}

export async function panoMessage(pano) {
	return sendMessage(panoChannel, panoMessageContent(pano));
}

export async function installMessage(appointment) {
	return sendMessage(installChannel, installMessageContent(appointment))
}

export async function rescheduleMessage(appointment, slack_ts) {
	const channel = await getChannel(installChannel);
	if (!channel) {
		console.log(`#${channelName} not found`);
		return;
	}

	const { text, blocks } = installMessageContent(appointment);
	const formattedDate = format(appointment.date, dateFmtString)

	const res = await slack.chat.update({
		channel: channel.id,
		ts: slack_ts,
		text,
		blocks,
	});

	return slack.chat.postMessage({
		channel: channel.id,
		thread_ts: slack_ts,
		reply_broadcast: true,
		text: `Rescheduled to ${formattedDate}`,
	});
}

async function sendMessage(channelName, messageContent, slack_ts) {
	const channel = await getChannel(channelName);
	if (!channel) {
		console.log(`#${channelName} not found`);
		return;
	}

	const { text, blocks } = messageContent;

	return slack.chat.postMessage({
		channel: channel.id,
		text,
		blocks,
	});
}

function requestMessageContent(request, building, member, visibleNodes) {
	const { id, roof_access } = request;
	const { address, lat, lng, alt, bin } = building;
	const altMeters = Math.round(alt * 0.328);
	const losString = getLoSString(visibleNodes);
	const roofString = roof_access ? "Roof access" : "No roof access";
	const mapURL = getMapURL(id);
	const earthURL = getEarthURL(building);
	const losURL = getLosURL(building);
	const ticketURL = getTicketURL(id);

	const title = `*<${mapURL}|${address}>*`;
	const info = `${altMeters}m · ${roofString} · ${losString}`;
	const links = `<${earthURL}|Earth →>\t<${losURL}|LoS →>\t<${ticketURL}|Ticket →>`;
	const text = `${title}\n${info}\n${links}`;
	const fallbackText = `${address} · ${info}`;

	return {
		blocks: [markdownSection(text)],
		text: fallbackText,
	}
}

export async function panoMessageContent(pano) {
	const blocks = [
		{
			type: "image",
			title: {
				type: "plain_text",
				text: "Panorama 1",
			},
			image_url: pano.url,
			alt_text: "Panorama 1",
		},
		{
			type: "actions",
			elements: [
				{
					type: "button",
					text: {
						type: "plain_text",
						emoji: true,
						text: "Schedule Install",
					},
					style: "primary",
					value: "click_me_123",
				},
				{
					type: "button",
					text: {
						type: "plain_text",
						emoji: true,
						text: "No Line of Sight",
					},
					style: "danger",
					value: "click_me_123",
				},
			],
		},
	];

	const fallbackText = `New pano for ${pano.node_id}!`;

	return {
		blocks,
		text: fallbackText,
	}
}

// If slack_ts, update existing message and post in thread
export async function installMessageContent(appointment, slack_ts) {
	const { building, member } = appointment;
	const formattedDate = format(appointment.date, "EEEE, MMM d h:mm aa");
	const mapURL = getMapURL(appointment.request_id);
	const earthURL = getEarthURL(building);
	const losURL = getLosURL(building);
	const ticketURL = getTicketURL(appointment.request_id);

	const introText = `New ${appointment.type}:\n*${building.address}*\n${formattedDate}`;
	const nameText = `*Name:*\t${member.name}\n`;
	const phoneText = `*Phone:*\t<tel:${member.phone}|${member.phone}>\n`;
	const emailText = `*Email:*\t${member.email}\n`;
	const nodeText = `*Node:*\t<${mapURL}|${appointment.node_id}>\n`;
	const notesText = appointment.notes ? `*Notes:*\t${appointment.notes}` : "";
	const infoText = `${nameText}${phoneText}${emailText}${nodeText}${notesText}`;
	const linksText = `<${earthURL}|Earth →>\t<${losURL}|LoS →>\t<${ticketURL}|Ticket →>`;

	const fallbackText = `New ${appointment.type}:\n${building.address}\n${formattedDate}`;

	const blocks = [
		markdownSection(introText),
		markdownSection(infoText),
		markdownSection(linksText),
		markdownSection("Are you available? Thread here"),
	];

	return {
		blocks,
		text: fallbackText,
	}
}

async function getChannel(channelName) {
	const { channels } = await slack.conversations.list({
		types: "public_channel,private_channel",
		limit: 1000, // TODO: Cursor support
	});
	const [channel] = channels.filter((c) => c.name === channelName);
	return channel;
}

function markdownSection(text) {
	return {
		type: "section",
		text: {
			type: "mrkdwn",
			text,
		},
	};
}

function getLoSString(visibleNodes) {
	if (!visibleNodes) {
		return "LoS Failed";
	}

	if (!visibleNodes.length) {
		return "No LoS";
	}

	const isKnownDevice = (device) => device.type.name !== "Unknown";
	const hasDevice = (node) => node.devices.filter(isKnownDevice).length;
	const toIdentifier = (node) => node.name || node.id

	return visibleNodes.filter(hasDevice).map(toIdentifier).join(", ")
}

function getMapURL(id) {
	return `https://www.nycmesh.net/map/nodes/${id}`;
}

function getEarthURL(building) {
	const { address, lat, lng, alt } = building;
	const earthAddress = address.replace(/,/g, "").replace(/ /g, "+");
	return `https://earth.google.com/web/search/${earthAddress}/@${lat},${lng},${alt}a,300d,40y,0.6h,65t,0r`;
}

function getLosURL(building) {
	const { address, bin, lat, lng } = building;
	const URIAddress = encodeURIComponent(address);
	return `https://los.nycmesh.net/search?address=${URIAddress}&bin=${bin}&lat=${lat}&lng=${lng}`;
}

function getTicketURL(id) {
	return `https://support.nycmesh.net/scp/tickets.php?a=search&query=${id}`;
}

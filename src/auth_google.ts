import fetch from "node-fetch";
import { AuthorizationCode } from "simple-oauth2";
import prisma from "./api/prisma";
import { createUser, getUserByEmail } from "./api/users";

export interface GoogleProfile {
	id: string;
	email: string;
	verified_email: boolean;
	name: string;
	given_name: string;
	family_name: string;
	picture: string;
	locale: "en";
}

const tokenURL = "https://oauth2.googleapis.com/token";
const client = {
	id: process.env.GOOGLE_KEY_ID,
	secret: process.env.GOOGLE_KEY_SECRET,
	redirectUri: process.env.REDIRECT_URI,
};

async function getAccessToken(code: string, redirectUrl: string): Promise<string | null> {
	if (!client.id || !client.secret) {
		console.error("Google OAuth client ID or secret is missing.");
		return null;
	}

	console.log("Authorization code received:", code); // Log the authorization code

	try {
		const response = await fetch(tokenURL, {
			body: JSON.stringify({
				code,
				grant_type: "authorization_code",
				client_id: client.id,
				client_secret: client.secret,
				redirect_uri: redirectUrl,
			}),
			method: "POST",
			headers: { "Content-Type": "application/json" },
		});

		if (!response.ok) {
			console.error(`Failed to fetch access token. Status: ${response.status}`);
			const errorDetails = await response.json();
			console.error("Error details:", errorDetails);
			return null;
		}

		const result = (await response.json()) as { access_token: string };
		console.log("Access token received:", result.access_token); // Log the access token
		return result.access_token;
	} catch (e) {
		console.error("Error fetching access token:", e);
		return null;
	}
}

export async function getGoogleProfile(code: string, redirectUrl: string): Promise<GoogleProfile | null> {
	const accessToken = await getAccessToken(code, redirectUrl);

	if (!accessToken) {
		console.error("Failed to retrieve access token.");
		return null;
	}

	const profileUrl = `https://www.googleapis.com/oauth2/v1/userinfo?alt=json&access_token=${accessToken}`;

	try {
		const res = await fetch(profileUrl);
		if (!res.ok) {
			console.error(`Failed to fetch Google profile. Status: ${res.status}`);
			return null;
		}

		const profile = await res.json();
		console.log("Google profile received:", profile); // Log the Google profile
		return profile;
	} catch (e) {
		console.error("Error when fetching Google profile:", e);
		return null;
	}
}

export async function getUserIDFromGoogleCode(code: string, redirectUrl: string): Promise<number | null> {
	try {
		const profile = await getGoogleProfile(code, redirectUrl);

		if (!profile) {
			console.error("Failed to retrieve Google profile.");
			return null;
		}

		const user = await getUserByEmail(profile.email);
		console.error(user, 'user object check')
		if (user == null) {
			const userId = await createUser({
				name: profile.name,
				email: profile.email,
			});
			console.log("New user created with ID:", userId); // Log the new user ID
			return userId;
		} else {
			console.log("Existing user ID:", user.id); // Log the existing user ID
			return user.id;
		}
	} catch (e) {
		console.error("Error in getUserIDFromGoogleCode:", e);
		return null;
	}
}

/**
 * Options and copy for the first-time user-profile onboarding flow.
 * Everything collected here is stored locally in browser settings only --
 * nothing here is ever sent anywhere except into this app's own system
 * message / MCP profile tools.
 */

export interface ProfileCategoryOption {
	value: string;
	label: string;
	/** Placeholder for the optional category-specific follow-up question. */
	followUpPlaceholder: string;
}

export const PROFILE_CATEGORY_OPTIONS: ProfileCategoryOption[] = [
	{
		value: 'student',
		label: 'Student',
		followUpPlaceholder: 'e.g. "Computer Science, 2nd year"'
	},
	{
		value: 'engineer',
		label: 'Engineer / Developer',
		followUpPlaceholder: 'e.g. "Backend developer, mostly Go and Python"'
	},
	{
		value: 'doctor',
		label: 'Doctor / Healthcare',
		followUpPlaceholder: 'e.g. "General physician"'
	},
	{
		value: 'worker',
		label: 'Worker / Professional',
		followUpPlaceholder: 'e.g. "Marketing, small business owner"'
	},
	{
		value: 'teacher',
		label: 'Teacher / Educator',
		followUpPlaceholder: 'e.g. "High school math teacher"'
	},
	{
		value: 'creative',
		label: 'Creative / Artist',
		followUpPlaceholder: 'e.g. "Illustrator and game designer"'
	},
	{
		value: 'other',
		label: 'Other',
		followUpPlaceholder: 'e.g. "Retired, hobbyist programmer"'
	}
];

export const PROFILE_ONBOARDING_STEPS = ['name', 'avatar', 'description', 'category', 'ai-nickname'] as const;

export type ProfileOnboardingStep = (typeof PROFILE_ONBOARDING_STEPS)[number];

/** Max square size (px) an uploaded avatar is downscaled to before storing as a data URL. */
export const PROFILE_AVATAR_MAX_DIMENSION = 128;

/** The exact phrase the user must type to confirm deleting their profile. */
export const PROFILE_DELETE_CONFIRM_PHRASE = 'delete my profile';

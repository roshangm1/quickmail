import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { loadMailbox } from '$lib/server/mailbox';

export const load: PageServerLoad = async ({ locals, platform, url }) => {
	const requested = url.searchParams.get('view');
	if ((requested === 'archive' || requested === 'snoozed') && locals.uiTheme !== 'classic') {
		const next = new URL(url);
		next.pathname = `/${requested}`;
		next.searchParams.delete('view');
		throw redirect(303, `${next.pathname}${next.search}`);
	}
	const view = requested === 'archive' || requested === 'snoozed' ? requested : 'inbox';
	return loadMailbox(platform?.env.DB, locals.user?.id, view, url, locals.activeDomainId);
};

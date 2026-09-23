/** The rolling three-month window shared by exercise charts, history and analysis. */
export function exerciseReviewPeriod(now = new Date()) {
	const to = new Date(now);
	const from = new Date(to);
	from.setMonth(from.getMonth() - 3);
	return { from: from.toISOString(), to: to.toISOString() };
}

// Baseline (Explore, before any coaching) and Apply (fresh problem, AI off) — one tap-answer each so both can be
// scored server-side. The Apply question is related to but different from the task, as the evidence model requires.
const q = (q, options, answer) => ({ q, options, answer });
export const ASSESSMENTS = {
  mw_coin:    { baseline: q('Which coin is worth the most?', ['1p', '10p', '5p'], 1), apply: q('Which makes exactly 15p?', ['10p + 5p', '5p + 2p', '10p + 10p'], 0) },
  mw_change:  { baseline: q('£1 is the same as how many pence?', ['10p', '100p', '50p'], 1), apply: q('A comic costs 45p. You pay with £1. Your change is…', ['45p', '55p', '65p'], 1) },
  mw_jar:     { baseline: q('You save 50p a week. After 2 weeks you have…', ['50p', '£1', '£2'], 1), apply: q('£1 a week, but you spend 40p on a comic. Weeks to save £3?', ['3', '5', '10'], 1) },
  mw_party:   { baseline: q('2 bottles of squash at £1.20 each cost…', ['£1.20', '£2.40', '£3.60'], 1), apply: q('Budget £10, must-haves £8.10. How much is left?', ['£1.90', '£2.10', '£1.10'], 0) },
  mw_coins:   { baseline: q('A pop-up says “free coins — type a card number”. First move?', ['Type it quickly', 'Stop and tell a grown-up', 'Send a gift-card code'], 1), apply: q('A video says you won a prize but must pay £1 postage through a link. You…', ['Pay it', 'Close it and tell an adult', 'Share the link with friends'], 1) },
  mw_juice:   { baseline: q('A business spends £24 making juice shots and takes £36 in sales. Profit?', ['£12', '£60', 'No profit'], 0), apply: q('Costs £11 + £5 + £1 + £8. 16 shots sell at £2. Profit?', ['£7', '£32', '£25'], 0) },
  mw_sale:    { baseline: q('10% of £45 is…', ['£4.50', '£9', '£45'], 0), apply: q('A £24 book at 25% off, or £19 plus £2.50 delivery. Cheaper?', ['25% off (£18)', '£19 + delivery (£21.50)', 'The same'], 0) },
  mw_juice2:  { baseline: q('Which is a FIXED cost?', ['Stall fee', 'Ingredients per shot', 'Bottles per shot'], 0), apply: q('Price £1.50, variable cost 60p, fixed £9. Break-even?', ['6 shots', '10 shots', '15 shots'], 1) },
  cs_bfast:   { baseline: q('Milk comes from…', ['a plant', 'a cow', 'the sea'], 1), apply: q('Which comes from a plant?', ['Cheese', 'Carrot', 'Yoghurt'], 1) },
  cs_kebab:   { baseline: q('Before you touch food you…', ['Wash your hands', 'Eat a grape', 'Put fruit on the stick'], 0), apply: q('Grapes are cut lengthways because…', ['They taste better', 'Whole grapes can choke', 'They look nicer'], 1) },
  cs_plate:   { baseline: q('Chips belong to which Eatwell group?', ['Starchy foods', 'Dairy', 'Fruit and veg'], 0), apply: q('Lunch: white bread, crisps, chocolate, cola. Which groups are missing?', ['Fruit/veg and dairy', 'Starchy foods', 'None'], 0) },
  cs_cupboard:{ baseline: q('Onion 30p + frozen peas £1.00 =', ['£1.30', '£1.03', '£3.10'], 0), apply: q('Fresh budget £2: onion 30p + peas £1 + cheese £1.20. Does it fit?', ['Yes', 'No — it is £2.50', 'Exactly £2'], 1) },
  cs_lunch:   { baseline: q('Which fruit is in season in the UK in autumn?', ['Strawberry', 'Apple', 'Pineapple'], 1), apply: q('How do you keep a yoghurt safe until lunch on a hot day?', ['Leave it in the bag', 'Insulated bag with an ice pack', 'Warm it up'], 1) },
  cs_soup:    { baseline: q('300g doubled is…', ['600g', '300g', '900g'], 0), apply: q('A sauce for 4 uses 200g tomatoes. For 12 people?', ['400g', '600g', '800g'], 1) },
  cs_scale:   { baseline: q('A recipe for 2 uses 1 egg. For 6 people?', ['2 eggs', '3 eggs', '6 eggs'], 1), apply: q('2 apples for 4 people. For 10 people?', ['4', '5', '8'], 1) },
  cs_wraps:   { baseline: q('A stall spends £24 making wraps and takes £36. Profit?', ['£12', '£60', 'No profit'], 0), apply: q('Fillings £12, wraps £3, bags £2, stall £6. 15 wraps sell at £2. Profit?', ['£7', '£30', '£23'], 0) },
  cs_allergy: { baseline: q('“May contain nuts” means…', ['Safe for everyone', 'Not safe for a nut allergy', 'Only a little nut'], 1), apply: q('A label is missing. You…', ['Serve it anyway', 'Guess from the look', 'Do not serve it — ask an adult'], 2) },
  cs_stall:   { baseline: q('Ingredients cost £6.70 for 10 portions. Cost per portion?', ['67p', '£6.70', '£1.50'], 0), apply: q('8 portions sold at £1.25, ingredients £6. Profit?', ['£4', '£10', '£16'], 0) },
  cs_wraps2:  { baseline: q('Which is a VARIABLE cost?', ['Stall fee', 'Fillings per wrap', 'Paper bags (fixed)'], 1), apply: q('Price £1.50, variable 55p, fixed £9, 12 sold. Profit?', ['£2.40', '£9', '£18'], 0) },
};

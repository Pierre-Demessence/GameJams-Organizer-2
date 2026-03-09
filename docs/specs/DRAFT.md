# Gamejam Organizer Website

## Terminology

- Website Admin: TODO
- Website Moderator: TODO

- ---

- Gamejam: An event where people create games in a limited time frame, usually around a theme.\
- Jam Admin: A user who has all permissions for a gamejam, including editing the jam, managing submissions, managing users, etc. The creator of the jam is by default an admin.\
- Jam Moderator: A user who has permissions to manage submissions (edit, disqualify, delete), but can't edit the jam itself or manage users.\
- Judge: A user who is allowed to rate submissions even if they didn't submit a game themselves
- Host: A user who is credited as a host of the gamejam, but doesn't have any specific permissions.
- Organizers: Everyone involved in the management of the jam.

- ---

- Submission: A game submitted to a gamejam. Each submission can have multiple contributors, but only one submitter (the one who created the submission).\
- Contributor: A user who is part of a submission, but is not the submitter. They have the same permissions as the submitter for that submission, but they are not identified differently.\
- Team: A submission where the submitter has added at least one contributor.\

- ---

- Rating: A score given to a submission by a user during the rating period of a gamejam.\
- Voting: The process of selecting a theme or other aspects of a gamejam through user input.

## Global Features

This website will be a website to organize gamejams.
Features:

- A calendar to show upcoming gamejams.
- A page to list jams, whatever their statuses, and search them.
- Reminder notifications for start, voting, results, etc... By using email.
  - Jam organizes can
- People can register through Discord.
- People can organize gamejams.
- People can optionally vote for gamejams theme.
- People can submit games to gamejams.
- People can rate games submitted to gamejams.

## Gamejams

- Status: DRAFT -> UPCOMING -> (THEME_VOTING) -> ONGOING -> (RATING) -> FINISHED
  - These are the possible status of a jam. Some status have a dates associated with them, and the jam automatically transition to the next status when the date is reached. For example, a jam can be in UPCOMING status until the start date is reached, then it automatically transition to ONGOING status.\ The dates cannot overlap. For example, the start date of the jam must be before the end date of the jam, and the end date of the jam must be after the end date of the rating period (for ranked jams).
- People can join during UPCOMING and ONGOING status.

### Basic infos

- Name
- Short description
- Vanity URL (slug)
- Full Description with markdown/HTML support
- Cover image
- Submission details (Shown on the top of the submission dialog as someone is adding their game)
- Social media hashtag (Submitters will be prompted to use this hashtag when talking about the jam or their submissions)
- Tags (Used for filtering and discovering when your jam is listed. You can type your own if there are no appropriate suggestions)

### Settings

- Ranked / Non-ranked
- Date and time for:
  - Start of the gamejam
  - End of the gamejam (and start of the rating period)
  - (Ranked Only) End of the rating period
- (Optional) Theme.
- Enable community (Provides a message board for your jam, accessible from your jam's page)
- Hide results (Results of jam are always hidden from the public when this is enabled, even if the jam's rating period is over. Use this to manually control when results are made public.)
- Hide submissions before end (The submission list is hidden from jam's page until the submission period is over. Individual submission pages can still be accessed by direct URL or from the project's page.)

### Visibility

- Public (Jam is visible by the public and ready for submissions and ratings when appropriate)
- Unlisted (Jam will not be listed on the website, but can be accessed by direct URL)

### Submission settings

- (Optional) Max Team Size (If not specified, there is no limit to the number of people in a team)
- Whether to allow submissions to add contributors after submissions close.
- Submission fields (Create custom fields to allow entrants to provide additional data with their submissions. Avoid changing fields during the submission period to get consistent responses. Fields can not be changed after the submission period is over)\
Each field has:
  - Name (e.g., "Game Engine Used")
  - Description
  - Type (Single line, multi-line, URL, etc.)
  - Required or optional
  - Private or public (Private fields are only visible to the jam organizers and judges, while public fields are visible to everyone)

### Jam permissions

After a jam is created, the jam organizers can give permissions to other users to help manage the jam.\
Permissions include:

- Admin (Allowed to edit the jam and any submissions. The creator of the jam is admin)
- Moderator (Allowed to edit/disqualify submissions, but not the jam itself)
- Judge (Allowed to rate submissions even if they didn't submit, but not edit anything)
- Host (No specific permissions, but get credited)

### Ranked Gamejams

Everything in this part is only for ranked gamejams.

- Who can rate for the jam:
  - Submitters only (team leader)
  - Submitters and contributors (everyone in the team)
  - Judges (a group of people selected by the jam organizers)
  - Everyone (anyone with an account on the website)
- Criteria\
Each criterion has:
  - Name
  - (Optional) Description
  - (Optional) Weight (Used for ranked gamejams to calculate final scores. If not specified defaults to 1. Can be 0 for criteria that are not used for scoring but you still want to collect ratings for)

DRAFT:

When the rating period is on, people should be able to rate other people games on each criteria on a scale of 1 to 5.\
They can't rate for their own submission.
Ratings are anonymous.
The formula to rank games should include the weights, but also the number of ratings, to avoid a game with only 1 rating being first because it got a 5/5.\ This should give a "raw score" and a "weighted score", and only the weighted score is used for ranking.\
Formula to be determined.
In case of a tie, the game with the highest number of ratings should be ranked higher.\
In case of another tie, the game with the highest raw score should be ranked higher.\
In case of another tie, one is randomly selected between the tied games to be ranked higher.

#### Rating Queue

DRAFT:

Basically a system to force people to rate some games before being able to rate freely. They should be able to select preferred platform to avoid being forced to rate games they can't play. This should be opt-in
Cf: <https://itch.io/docs/creators/game-jams#jam-customization/rating-queue>

Another system that achieve a goal kinda similar is having submissions who rates others get more visibility. A kind of "karma" system where the more you rate, the more your submission gets visible on the jam page.

### Theme

Everything in this part is only for gamejams with a theme.

Jam organizers can set a theme for the jam.
They can decide if the theme is revealed instantly or only when the jam starts.\

#### Theme Voting

DRAFT:

Jam organizers can either select a theme themselves (single field), or have the community vote on a theme (multiple options).\
If the organizers chooses to have the community vote on a theme, they can set a list of theme options for the community to choose from.\
They also have to set a date and time for the start of the theme voting period.\
They end of the theme voting period is optional, in whihch case the theme voting will end when the gamejam starts.\
When voting, users see the list of themes and for each theme they can vote NO, YES or N/A.\

### Prizes

Everything in this part is only for ranked gamejams.

DRAFT:

I would like a system where the jam organizers can list prizes for the jam, and set which prize goes to which place (1st, 2nd, 3rd, etc.).\
And then another system where if there are multiples prizes for the same place, team members of the winning team can declare who gets what.
Note: The prizes are "intent" there is no actual prizes management on the website, it's just for the organizers to list what they intend to give to the winners and team members declare who gets what, so the jam organize knows who to give what.

## Submissions / Teams

There are no inherent concept of "Teams". Instead, there are "Submissions" and each submission can have multiple "Contributors". And that's a team.\ So each submission is a team, and the submitter is the team leader by default.\

- Title
- Description with markdown/HTML support
- Cover image
- Links to the game:
  - Windows
  - Mac
  - Linux
  - Web
- Screenshots (stored on user's own server or third-party service like Imgur)
- Video link (e.g., YouTube, Twitch, etc.)
- Additional fields defined by the jam organizers

DRAFT:

People can invite other users to their submission as contributors.\
Contributors have the same permissions as the submitter. They are also not identified differently.
Only one is "Team Leader" and is by default the one who created the submission, but they can transfer the team leader role to another contributor if they want.\
When rating is restricted to submitters only, only the team leader can rate for the submission.
People can only belong to ONE submission per jam, but they can be in different submissions for different jams.
Once the rating period starts, contributors can't be added or removed from a submission, but the jam organizers can allow contributors to be added after the submission period is over, in which case contributors can be added until the end of the jam, but not during the rating period.

Submissions can be disqualified, hidden or straight up deleted by jam admins and moderators.\
Disqualified submissions are still visible on the jam page, but they are marked as disqualified and can't be rated and can't win.

IMPORTANT:

Since we do not host content ourself, and submissions are mere "links", we need something to prevent people from submitting work that isn't theirs.
One potential solution is having our website "verify" submissions by giving a code, asking people to put the code on the webpage (ex: on the itch.io game page), and then clicking on a verify button. The website will then check if the code is on the page, if yes, the submissions is indeed the owner's. Need to iterate on this solution.

NOTES:

Need to think of a way to accept late submissions, for people who want to submit after the submission deadline, but still want to be part of the jam and get feedback from the community.

## User Accounts

- Users can register and log in using:
  - Discord
  - Google
  - GitHub
  - Email and password
  - Other?
- If using OAuth, email and password is optional.
- Users can merge account later.

- User can:
- Create a gamejam
- Join a gamejam as a participant
- Submit a game to a gamejam

- User Profile:
  - Username
  - Display name
  - Bio
  - Profile picture (stored on user's own server or third-party service)
  - List of gamejams created/participated in (as admin/moderator?/judge/host)
  - List of submissions/teams participated in

## Notes

- Project will be ENTIRELY FREE.
- NO USER ASSETS on our servers. User profile pictures, game screenshots, game files, etc. should be stored on the user's own servers or on third-party services (e.g., Imgur for images, GitHub for game files, itch.io for games).

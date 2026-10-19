"""Тексты записей Listening демо-теста: из них озвучиваются mp3 (make_audio.py) и берётся транскрипт.

Голоса: "uk" — британский, "au" — австралийский (gTTS с разными доменами).
"""

PARTS = [
    {
        "title": "Part 1 — Joining a sports centre",
        "lines": [
            ("uk", "Good morning, Riverside Sports Centre, Mark speaking. How can I help you?"),
            ("au", "Hello. I'd like to become a member of the centre, please."),
            ("uk", "Certainly. I'll fill in the membership form for you. What's your name?"),
            ("au", "Sarah Collins."),
            ("uk", "Could you spell your surname for me?"),
            ("au", "Yes, it's C, O, L, L, I, N, S."),
            ("uk", "Thank you. And what's your address?"),
            ("au", "It's 42 Park Road. That's in Greenfield."),
            ("uk", "Greenfield. Is that G, R, E, E, N, F, I, E, L, D?"),
            ("au", "That's right."),
            ("uk", "And what do you do, Sarah?"),
            ("au", "I'm a nurse at the city hospital, so I often work shifts."),
            ("uk", "OK. We have three types of membership: individual, couple and family. Which one would you like?"),
            ("au", "Well, I was going to choose individual, but my husband and two children want to come too, so family, please."),
            ("uk", "The family membership usually costs fifty-two pounds a month. Oh, wait. There's a discount this month, so it's forty-five pounds."),
            ("au", "Forty-five pounds. That's great."),
            ("uk", "What are you mainly interested in? We have a gym, tennis courts and a pool."),
            ("au", "The gym looks nice, but mostly swimming. I try to swim every week."),
            ("uk", "We also run classes. Which day suits you best?"),
            ("au", "Not Monday. Thursday is best for me, because I don't work that day."),
            ("uk", "Thursday. And can I ask how you heard about us?"),
            ("au", "My neighbour mentioned you, but actually I first saw an advert in the newspaper."),
            ("uk", "The newspaper, good. And when would you like to start?"),
            ("au", "Could I start on the third of June?"),
            ("uk", "Yes, the third of June is fine. Thank you, Sarah. See you soon."),
        ],
    },
    {
        "title": "Part 2 — A guide to the Harbour Museum",
        "lines": [
            ("uk", "Welcome to the Harbour Museum. My name is Jenny, and I'll tell you a little about the museum before you start your visit."),
            ("uk", "The museum opened in nineteen ninety-eight in a building that was originally the town's fish market. Later it was used as a warehouse for many years. Most visitors spend about two hours here."),
            ("uk", "On the ground floor you'll find the shipbuilding gallery. This is our most popular area, especially with children, because they can try building a small wooden boat themselves."),
            ("uk", "The first floor is about the history of fishing in the town. Please note that photographs are not allowed in this gallery, because the flash could damage some of the old maps."),
            ("uk", "Our café is on the top floor, and it has wonderful views of the harbour. It serves hot meals until three o'clock. After that, only drinks and cakes are available."),
            ("uk", "Now, some practical information. Tickets for adults cost eight pounds, but students pay only five pounds. Audio guides are free, and you can collect them from the reception desk. If you'd like to leave your bags, there are lockers next to the shop. The shop sells postcards, books and model ships."),
            ("uk", "Finally, every Saturday we run a special workshop where you can learn how to tie sailors' knots. It starts at eleven o'clock and places are limited, so please book early at reception. Enjoy your visit."),
        ],
    },
    {
        "title": "Part 3 — Planning a student project",
        "lines": [
            ("uk", "So, Anna, have you decided on a topic for our environmental science project?"),
            ("au", "I think we should look at community gardens in the city. There are more than twenty of them now."),
            ("uk", "Good idea. Our tutor said the project must be finished by the end of April, so we don't have much time."),
            ("au", "Right. I suggest we start with a survey of the people who use the gardens."),
            ("uk", "How many people should we ask? Fifty?"),
            ("au", "That's too many in three weeks. Let's aim for thirty."),
            ("uk", "OK. And I think we should visit the gardens in the morning, because that's when most of the volunteers are there."),
            ("au", "Agreed. Now, I read an article which said the main benefit of community gardens isn't the food. It's that people get to know their neighbours."),
            ("uk", "Interesting. I thought it would be about saving money on vegetables."),
            ("au", "Apparently not. Most people said the social side was the most important thing."),
            ("uk", "What about problems?"),
            ("au", "The biggest one is water. Many gardens don't have a tap, so volunteers have to carry water in bottles."),
            ("uk", "Let's divide the work. You're better at statistics, Anna, so could you analyse the survey results?"),
            ("au", "Fine. And you could take the photos, Tom, since you have a good camera."),
            ("uk", "Sure. I'll write the introduction as well. Who'll make the presentation slides?"),
            ("au", "I'll do those too. I enjoy designing them."),
            ("uk", "And the bibliography?"),
            ("au", "Let's ask Ben. He joined the group last week and he needs a task."),
        ],
    },
    {
        "title": "Part 4 — A lecture on honey bees",
        "lines": [
            ("uk", "Today I'm going to talk about honey bees and why they are so important."),
            ("uk", "A single colony can contain up to sixty thousand bees, and almost all of them are female worker bees. The queen is the only bee that lays eggs, and in summer she can lay about two thousand eggs a day."),
            ("uk", "Worker bees have different jobs depending on their age. Young bees clean the hive and feed the larvae. Older bees become foragers, which means they leave the hive to collect nectar and pollen."),
            ("uk", "So how do bees tell each other where food is? They perform what is called the waggle dance. The direction of the dance shows the direction of the food in relation to the sun, and the length of the dance shows the distance."),
            ("uk", "Bees are essential for agriculture. Around one third of the food we eat depends on pollination by insects, mainly bees. Crops such as apples and almonds would be very difficult to grow without them."),
            ("uk", "Unfortunately, bee populations are falling. Scientists believe the main causes are pesticides, disease and the loss of wild flowers. One simple thing people can do to help is to plant flowers in their gardens, especially ones that bloom in early spring."),
        ],
    },
]


def transcript(part: dict) -> str:
    """Транскрипт для ученика после сдачи: в диалоге — реплики с новой строки."""
    return "\n\n".join(text for _, text in part["lines"])

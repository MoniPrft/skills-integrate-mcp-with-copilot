document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");
  const searchInput = document.getElementById("activity-search");
  const categoryFilter = document.getElementById("category-filter");
  const sortBy = document.getElementById("sort-by");
  const activityCount = document.getElementById("activity-count");
  const weekdays = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];
  let allActivities = {};

  function getScheduleSortKey(schedule) {
    const normalizedSchedule = schedule.toLowerCase();
    const weekdayIndex = weekdays.findIndex((day) =>
      new RegExp(`\\b${day}s?\\b`).test(normalizedSchedule)
    );
    const timeMatch = normalizedSchedule.match(
      /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/
    );

    if (weekdayIndex === -1 || !timeMatch) {
      return [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, normalizedSchedule];
    }

    let hour = Number(timeMatch[1]) % 12;
    if (timeMatch[3] === "pm") {
      hour += 12;
    }
    const minuteOfDay = hour * 60 + Number(timeMatch[2] || 0);

    return [weekdayIndex, minuteOfDay, normalizedSchedule];
  }

  function populateFilters() {
    categoryFilter.replaceChildren(new Option("All categories", ""));
    const categories = [
      ...new Set(Object.values(allActivities).map((details) => details.category)),
    ].sort((first, second) => first.localeCompare(second));

    categories.forEach((category) => {
      categoryFilter.add(new Option(category, category));
    });

    activitySelect.replaceChildren(new Option("-- Select an activity --", ""));
    Object.keys(allActivities)
      .sort((first, second) => first.localeCompare(second))
      .forEach((name) => activitySelect.add(new Option(name, name)));
  }

  function renderActivities() {
    const searchTerm = searchInput.value.trim().toLowerCase();
    const selectedCategory = categoryFilter.value;
    const matchingActivities = Object.entries(allActivities).filter(
      ([name, details]) => {
        const matchesCategory =
          !selectedCategory || details.category === selectedCategory;
        const searchableText = [
          name,
          details.category,
          details.description,
          details.schedule,
        ]
          .join(" ")
          .toLowerCase();

        return matchesCategory && searchableText.includes(searchTerm);
      }
    );

    matchingActivities.sort(([firstName, firstDetails], [secondName, secondDetails]) => {
      if (sortBy.value === "schedule") {
        const [firstDay, firstTime, firstSchedule] = getScheduleSortKey(
          firstDetails.schedule
        );
        const [secondDay, secondTime, secondSchedule] = getScheduleSortKey(
          secondDetails.schedule
        );

        return (
          firstDay - secondDay ||
          firstTime - secondTime ||
          firstSchedule.localeCompare(secondSchedule) ||
          firstName.localeCompare(secondName)
        );
      }

      return firstName.localeCompare(secondName);
    });

    activitiesList.replaceChildren();
    activityCount.textContent = `${matchingActivities.length} of ${Object.keys(
      allActivities
    ).length} activities`;

    if (matchingActivities.length === 0) {
      const emptyMessage = document.createElement("p");
      emptyMessage.className = "activity-empty-state";
      emptyMessage.textContent = "No activities match your filters.";
      activitiesList.appendChild(emptyMessage);
      return;
    }

    matchingActivities.forEach(([name, details]) => {
      const activityCard = document.createElement("div");
      activityCard.className = "activity-card";

      const spotsLeft = details.max_participants - details.participants.length;
      const title = document.createElement("h4");
      title.textContent = name;
      activityCard.appendChild(title);

      [
        ["Category:", details.category],
        ["Description:", details.description],
        ["Schedule:", details.schedule],
        ["Availability:", `${spotsLeft} spots left`],
      ].forEach(([label, value]) => {
        const paragraph = document.createElement("p");
        const strong = document.createElement("strong");
        strong.textContent = `${label} `;
        paragraph.append(strong, document.createTextNode(value));
        activityCard.appendChild(paragraph);
      });

      const participantsContainer = document.createElement("div");
      participantsContainer.className = "participants-container";

      if (details.participants.length > 0) {
        const participantsSection = document.createElement("div");
        participantsSection.className = "participants-section";
        const participantsHeading = document.createElement("h5");
        participantsHeading.textContent = "Participants:";
        const participantsList = document.createElement("ul");
        participantsList.className = "participants-list";

        details.participants.forEach((email) => {
          const participant = document.createElement("li");
          const participantEmail = document.createElement("span");
          participantEmail.className = "participant-email";
          participantEmail.textContent = email;
          const unregisterButton = document.createElement("button");
          unregisterButton.className = "delete-btn";
          unregisterButton.type = "button";
          unregisterButton.setAttribute("aria-label", `Unregister ${email} from ${name}`);
          unregisterButton.dataset.activity = name;
          unregisterButton.dataset.email = email;
          unregisterButton.textContent = "❌";
          unregisterButton.addEventListener("click", handleUnregister);
          participant.append(participantEmail, unregisterButton);
          participantsList.appendChild(participant);
        });

        participantsSection.append(participantsHeading, participantsList);
        participantsContainer.appendChild(participantsSection);
      } else {
        const noParticipants = document.createElement("p");
        noParticipants.textContent = "No participants yet";
        participantsContainer.appendChild(noParticipants);
      }

      activityCard.appendChild(participantsContainer);
      activitiesList.appendChild(activityCard);
    });
  }

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      allActivities = await response.json();
      populateFilters();
      renderActivities();
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  searchInput.addEventListener("input", renderActivities);
  categoryFilter.addEventListener("change", renderActivities);
  sortBy.addEventListener("change", renderActivities);

  // Handle unregister functionality
  async function handleUnregister(event) {
    const button = event.target;
    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/unregister?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
        }
      );

      const result = await response.json();

      if (response.ok) {
        messageDiv.textContent = result.message;
        messageDiv.className = "success";

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        messageDiv.textContent = result.detail || "An error occurred";
        messageDiv.className = "error";
      }

      messageDiv.classList.remove("hidden");

      // Hide message after 5 seconds
      setTimeout(() => {
        messageDiv.classList.add("hidden");
      }, 5000);
    } catch (error) {
      messageDiv.textContent = "Failed to unregister. Please try again.";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      console.error("Error unregistering:", error);
    }
  }

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
        }
      );

      const result = await response.json();

      if (response.ok) {
        messageDiv.textContent = result.message;
        messageDiv.className = "success";
        signupForm.reset();

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        messageDiv.textContent = result.detail || "An error occurred";
        messageDiv.className = "error";
      }

      messageDiv.classList.remove("hidden");

      // Hide message after 5 seconds
      setTimeout(() => {
        messageDiv.classList.add("hidden");
      }, 5000);
    } catch (error) {
      messageDiv.textContent = "Failed to sign up. Please try again.";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      console.error("Error signing up:", error);
    }
  });

  // Initialize app
  fetchActivities();
});

document.addEventListener("DOMContentLoaded", () => {
  const loginToggle = document.getElementById("loginToggle");
  const authPopup = document.getElementById("authPopup");
  const closePopup = document.getElementById("closePopup");
  const authTabs = document.querySelectorAll(".auth-tabs button");
  const authForms = document.querySelectorAll(".auth-form");
  const logoutButton = document.getElementById("logoutButton");
  const createPost = document.getElementById("postForm");

  function updateUI() {
    const commentsSection = document.querySelectorAll(".comment-form");
    const disableInteraction = document.querySelectorAll(".interaction-button:not(.comment-button)");

    fetch("/check-session", {
      method: "GET",
      credentials: "same-origin", // Make sure cookies are sent with the request
    })
      .then((response) => {
        if (response.ok) {
          return response.json();
        } else {
          return response.json().then((data) => {
            throw new Error(data.message || "Unauthorized");
          });
        }
      })
      .then((data) => {
        if (data.loggedIn) {
          // User is logged in
          console.log("User is logged in.");

          commentsSection.forEach((section) => {
            section.style.display = "block";
          });
          createPost.style.display = "block";
          logoutButton.style.display = "inline-block";
          loginToggle.style.display = "none";
          disableInteraction.forEach((button) => {
            button.disabled = false;
          });

          authPopup.classList.remove("show"); 
        } else {
          // User is not logged in
          console.log("User is not logged in.");

          commentsSection.forEach((section) => {
            section.style.display = "none";
          });
          disableInteraction.forEach((button) => {
            button.disabled = true;
          });
          createPost.style.display = "none";
          logoutButton.style.display = "none";
          loginToggle.style.display = "inline-block";
        }
      })
      .catch((error) => {
        console.error("Session check failed:", error);
        // User is not logged in

        commentsSection.forEach((section) => {
          section.style.display = "none";
        });
        createPost.style.display = "none";
        logoutButton.style.display = "none";
        loginToggle.style.display = "inline-block";
        disableInteraction.forEach((button) => {
          button.disabled = true;
        });
      });
  }

  // Use MutationObserver to detect when elements are added to the DOM
  const observer = new MutationObserver((mutationsList, observer) => {
    for (const mutation of mutationsList) {
      if (mutation.type === 'childList') {
        updateUI();
      }
    }
  });
  
  loginToggle.addEventListener("click", () => {
    authPopup.classList.add("show");
  });

  // Start observing the document body for added nodes
  observer.observe(document.body, { childList: true, subtree: true });

  
  updateUI();

  
  authPopup.classList.add("show"); 

  // Close the popup when clicking on the close button
  closePopup.addEventListener("click", () => {
    authPopup.classList.remove("show");
  });

  authPopup.addEventListener("click", (e) => {
    if (e.target === authPopup) {
      authPopup.classList.remove("show");
    }
  });

  // Tab switching between login and register
  authTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const formType = tab.getAttribute("data-form");

      authTabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");

      authForms.forEach((form) => {
        form.classList.remove("active");
        if (form.id === `${formType}Form`) {
          form.classList.add("active");
        }
      });
    });
  });
});

document.getElementById("logoutButton").addEventListener("click", () => {
  fetch("/logout", {
    method: "POST",
    credentials: "include", // Ensure cookies are sent
  })
    .then((response) => {
      if (response.ok) {
        if (response.redirected) {
          // loadPosts();
          window.location.href = response.url;
        }
      } else {
        console.error("Logout failed with status:", response.status);
      }
    });
});
/************************************************** */
document.getElementById("loginForm").addEventListener("submit", function (event) {
  event.preventDefault();

  const user = document.getElementById("user").value;  
  const password = document.getElementById("loginPassword").value;
  const errorElement = document.getElementById("loginMessage");

  if (!user || !password) {
    errorElement.textContent = "Email/Username and password are required.";
    errorElement.style.display = "block";
    return;
  } else {
    errorElement.style.display = "none";  
  }

  // Prepare the form data for sending
  const formData = new FormData();
  formData.append("user", user); 
  formData.append("password", password);  

  document.querySelector("button").disabled = true;

  // Send the data to the backend using the fetch API
  fetch("/login", {
    method: "POST",
    body: formData,
    credentials: "include",  
  })
    .then((response) => {
      return response.json().then((data) => {
        if (!response.ok) {
          throw data;  
        }
        return data;  
      });
    })
    .then((data) => {
      // Success: Save user data and reset the form
      localStorage.setItem("username", data.username);  
      document.getElementById("loginForm").reset();  

      setTimeout(() => {
        window.location.href = "/";  // Redirect to the home page
      }, 500); 
    })
    .catch((error) => {
      console.log("Error object:", error);

      if (error && error.error) {
        errorElement.textContent = error.error;
        errorElement.style.display = "block";
      } else {
        
        alert("An unexpected error occurred. Check the console for details.");
      }
    })
    .finally(() => {

      document.querySelector("button").disabled = false;
    });
});

/************************************* */
document
  .getElementById("registerForm")
  .addEventListener("submit", function (event) {
    event.preventDefault();

    document.querySelectorAll(".form-group small").forEach((element) => {
      element.textContent = "";
      element.style.display = "none";
    });

    const formData = new FormData(this);

    const password = document.getElementById("registerPassword").value;
    const confirmPassword = document.getElementById("confirmPassword").value;
    const errorElement = document.getElementById("passwordError");

    if (password !== confirmPassword) {
      errorElement.textContent = "Passwords do not match!";
      errorElement.style.display = "block";
      return;
    }
    //  else {
    //   errorElement.style.display = "none";
    // }

    fetch("/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(formData).toString(),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.error === "Email or username already taken." && data.fields) {
          Object.entries(data.fields).forEach(([field, message]) => {
            const errorElement = document.getElementById(
              `register${capitalize(field)}`
            ).nextElementSibling;
            errorElement.textContent = message;
            errorElement.style.display = "block";
          });
        } else if (data.error) {
          alert(data.error);
        } else {
          alert(data.message);
          this.reset();
        }
      })
      .catch((error) => alert("An error occurred."));
  });

function capitalize(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

/****************************************** */

import { getRecipes } from "./services/recipes.js";

// Fallback recipe data if getRecipes fails
const defaultRecipes = [
  {
    nombre: "Pollo al Curry",
    imagen: "https://via.placeholder.com/250",
    tiempo: 30,
    pasos: "Cocina el pollo con especias y curry.",
    ingredientes: ["pollo", "curry", "arroz"],
    categoria: "Plato Principal"
  },
  {
    nombre: "Ensalada César",
    imagen: "https://via.placeholder.com/250",
    tiempo: 15,
    pasos: "Mezcla lechuga, crutones y aderezo César.",
    ingredientes: ["lechuga", "pollo", "parmesano"],
    categoria: "Entrante"
  }
];

// Load recipes, use fallback if import fails
const recetas = Array.isArray(getRecipes()) ? getRecipes() : defaultRecipes;

// DOM element references
const input = document.getElementById("ingredient-input");
const recipesContainer = document.getElementById("recipes");
const sortSelect = document.getElementById("sort");
const suggestionBtn = document.getElementById("suggestion-btn");
const recentSuggestionsList = document.getElementById("recent-suggestions");
const categoriesContainer = document.getElementById("categories");
const loadingSpinner = document.getElementById("loading");
const noResults = document.getElementById("no-results");

// State variables
let currentSuggestionIndex = -1;
let currentSuggestions = [];
let historialIngredientes = JSON.parse(localStorage.getItem("historialIngredientes")) || [];
let favoritos = JSON.parse(localStorage.getItem("favoritos")) || [];

// Show/hide loading spinner
function showLoading(show) {
  loadingSpinner.style.display = show ? "block" : "none";
  recipesContainer.style.display = show ? "none" : "flex";
}

// Show/hide "No results" message
function showNoResults(show) {
  noResults.style.display = show ? "block" : "none";
}

// Render recipe cards to the DOM
function renderRecetas(lista) {
  showLoading(false);
  recipesContainer.innerHTML = "";
  if (lista.length === 0) {
    showNoResults(true);
    return;
  }
  showNoResults(false);
  lista.forEach((receta) => {
    const card = document.createElement("div");
    card.className = "recipe-card fade-in";
    const esFavorito = favoritos.some(f => f.nombre === receta.nombre);
    card.innerHTML = `
      <img src="${receta.imagen}" alt="${receta.nombre}" />
      <h3>${receta.nombre}</h3>
      <p><strong>Tiempo:</strong> ${receta.tiempo} min</p>
      <p>${receta.pasos}</p>
      <button class="fav-btn" data-nombre="${receta.nombre}" aria-label="Marcar como favorito">${esFavorito ? '★' : '☆'}</button>
    `;
    recipesContainer.appendChild(card);
  });

  // Add event listeners to favorite buttons
  document.querySelectorAll(".fav-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const recetaNombre = btn.getAttribute("data-nombre");
      const receta = recetas.find(r => r.nombre === recetaNombre);
      toggleFavorito(receta);
      btn.textContent = favoritos.some(f => f.nombre === receta.nombre) ? '★' : '☆';
    });
  });
}

// Recursively check if a string contains a substring
function contieneSubcadena(texto, subcadena, i = 0) {
  if (subcadena.length === 0) return true;
  if (i + subcadena.length > texto.length) return false;
  for (let j = 0; j < subcadena.length; j++) {
    if (texto[i + j] !== subcadena[j]) {
      return contieneSubcadena(texto, subcadena, i + 1);
    }
  }
  return true;
}

// Recursively filter recipes by ingredients
function filtrarPorIngredientes(input, recetasRestantes = recetas, index = 0, resultados = []) {
  if (index >= recetasRestantes.length) return resultados;
  const ingredientes = input.toLowerCase().split(",").map(i => i.trim()).filter(i => i);
  if (ingredientes.every(ing => recetasRestantes[index].ingredientes.some(i => contieneSubcadena(i.toLowerCase(), ing)))) {
    resultados.push(recetasRestantes[index]);
  }
  return filtrarPorIngredientes(input, recetasRestantes, index + 1, resultados);
}

// Update ingredient history and analysis
function actualizarHistorial(ingredientes) {
  const ingredientesArray = ingredientes.split(",").map(i => i.trim()).filter(i => i);
  historialIngredientes.push(...ingredientesArray);
  if (historialIngredientes.length > 20) historialIngredientes = historialIngredientes.slice(-20);

  try {
    localStorage.setItem("historialIngredientes", JSON.stringify(historialIngredientes));
  } catch (e) {
    console.error("Error al guardar historial en localStorage:", e);
  }

  const unicos = [...new Set(historialIngredientes)];
  document.getElementById("analysis").textContent =
    `Usaste ${unicos.length} ingrediente${unicos.length !== 1 ? 's' : ''} esta semana.`;

  actualizarSugerenciasRecientes();
  renderizarHistorial();
}

// Recursively count frequency of ingredients
function contarFrecuencia(lista, conteo = {}, index = 0) {
  if (index >= lista.length) return conteo;
  const elem = lista[index];
  conteo[elem] = (conteo[elem] || 0) + 1;
  return contarFrecuencia(lista, conteo, index + 1);
}

// Update popular suggestions based on recent ingredients
function actualizarSugerenciasRecientes() {
  const ultimos = historialIngredientes.slice(-5);
  const frecuencia = contarFrecuencia(ultimos);
  const sugerencias = Object.entries(frecuencia).sort((a, b) => b[1] - a[1]).map(([ing]) => ing);
  document.getElementById("suggestions").textContent = `Populares: ${sugerencias.join(', ')}`;
}

// Recursively render recent ingredient history
function renderizarHistorial(historial = [...new Set(historialIngredientes)].slice(-5), index = 0) {
  if (index === 0) recentSuggestionsList.innerHTML = "";
  if (index >= historial.length) return;
  const li = document.createElement("li");
  li.textContent = historial[index];
  recentSuggestionsList.appendChild(li);
  renderizarHistorial(historial, index + 1);
}

// Display autocomplete suggestions for input
function autocompletar(valor) {
  const autocompletarDiv = document.getElementById("autocomplete-list");
  autocompletarDiv.innerHTML = "";
  if (!valor) return;
  currentSuggestions = [...new Set(recetas.flatMap(r => r.ingredientes))]
    .filter((ing) => ing.toLowerCase().startsWith(valor.toLowerCase()))
    .slice(0, 5);
  currentSuggestionIndex = -1;
  currentSuggestions.forEach((sug, index) => {
    const item = document.createElement("div");
    item.textContent = sug;
    item.classList.add("autocomplete-item");
    item.setAttribute("role", "option");
    item.setAttribute("aria-selected", index === currentSuggestionIndex);
    item.onclick = () => {
      input.value = sug;
      input.focus();
      buscarYRenderizar();
    };
    autocompletarDiv.appendChild(item);
  });
}

// Filter and render recipes based on input
function buscarYRenderizar() {
  const valor = input.value.trim();
  if (!valor) {
    renderRecetas(recetas);
    return;
  }
  showLoading(true);
  setTimeout(() => {
    const resultados = filtrarPorIngredientes(valor);
    actualizarHistorial(valor);
    renderRecetas(resultados);
  }, 500); // Simulate loading
}

// Recursively sort recipes using merge sort
function mergeSort(arr, clave) {
  if (arr.length <= 1) return arr;
  const medio = Math.floor(arr.length / 2);
  const izquierda = mergeSort(arr.slice(0, medio), clave);
  const derecha = mergeSort(arr.slice(medio), clave);
  return fusionar(izquierda, derecha, clave);
}

// Merge two sorted arrays for merge sort
function fusionar(izq, der, clave) {
  if (izq.length === 0) return der;
  if (der.length === 0) return izq;
  if (clave === "time") {
    return izq[0].tiempo < der[0].tiempo
      ? [izq[0]].concat(fusionar(izq.slice(1), der, clave))
      : [der[0]].concat(fusionar(izq, der.slice(1), clave));
  } else {
    return izq[0].nombre.localeCompare(der[0].nombre) < 0
      ? [izq[0]].concat(fusionar(izq.slice(1), der, clave))
      : [der[0]].concat(fusionar(izq, der.slice(1), clave));
  }
}

// Sort and render recipes by selected criterion
function ordenarRecetas(tipo) {
  showLoading(true);
  setTimeout(() => {
    const ordenadas = mergeSort([...recetas], tipo);
    renderRecetas(ordenadas);
  }, 500);
}

// Toggle a recipe as favorite and save to localStorage
function toggleFavorito(receta) {
  const existe = favoritos.find(f => f.nombre === receta.nombre);
  if (existe) {
    favoritos = favoritos.filter(f => f.nombre !== receta.nombre);
  } else {
    favoritos.push(receta);
  }
  try {
    localStorage.setItem("favoritos", JSON.stringify(favoritos));
  } catch (e) {
    console.error("Error al guardar favoritos en localStorage:", e);
  }
}

// Highlight active autocomplete suggestion
function highlightSuggestion(items) {
  items.forEach((item, index) => {
    item.classList.toggle("active", index === currentSuggestionIndex);
    item.setAttribute("aria-selected", index === currentSuggestionIndex);
  });
}

// Recursively render category buttons
function renderCategories(categorias = [...new Set(recetas.map(r => r.categoria))], index = 0) {
  if (index === 0) categoriesContainer.innerHTML = "";
  if (index >= categorias.length) return;
  const button = document.createElement("button");
  button.textContent = categorias[index];
  button.className = "category-btn";
  button.onclick = () => {
    showLoading(true);
    setTimeout(() => {
      const filtered = recetas.filter(r => r.categoria === categorias[index]);
      renderRecetas(filtered);
    }, 500);
  };
  categoriesContainer.appendChild(button);
  renderCategories(categorias, index + 1);
}

// Debounce function to limit frequent calls
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Debounced autocomplete function
const debouncedAutocomplete = debounce(autocompletar, 300);

// Event listener for input changes
input.addEventListener("input", (e) => {
  const value = e.target.value.trim();
  debouncedAutocomplete(value);
  if (!value) renderRecetas(recetas);
});

// Event listener for keyboard navigation in autocomplete
input.addEventListener("keydown", (e) => {
  const items = document.querySelectorAll(".autocomplete-item");
  if (e.key === "ArrowDown") {
    e.preventDefault();
    if (currentSuggestionIndex < items.length - 1) {
      currentSuggestionIndex++;
      highlightSuggestion(items);
    }
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    if (currentSuggestionIndex > 0) {
      currentSuggestionIndex--;
      highlightSuggestion(items);
    }
  } else if (e.key === "Enter") {
    if (currentSuggestionIndex >= 0 && items[currentSuggestionIndex]) {
      input.value = items[currentSuggestionIndex].textContent;
      document.getElementById("autocomplete-list").innerHTML = "";
    }
    buscarYRenderizar();
  }
});

// Event listener for sorting selection
sortSelect.addEventListener("change", (e) => ordenarRecetas(e.target.value));

// Event listener for suggestion button
suggestionBtn.addEventListener("click", () => {
  showLoading(true);
  setTimeout(() => {
    const recetaMasRapida = encontrarMasRapida(recetas);
    renderRecetas([recetaMasRapida]);
  }, 500);
});

// Recursively find the fastest recipe
function encontrarMasRapida(lista, mejor = null, index = 0) {
  if (index >= lista.length) return mejor;
  if (!mejor || lista[index].tiempo < mejor.tiempo) mejor = lista[index];
  return encontrarMasRapida(lista, mejor, index + 1);
}

// Initialize the app
try {
  renderRecetas(recetas);
  renderCategories();
} catch (e) {
  console.error("Error al inicializar la aplicación:", e);
  showNoResults(true);
}
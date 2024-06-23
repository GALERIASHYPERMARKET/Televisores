var contador=4;
const timeline = gsap.timeline({
  duration: 1,
  paused: false
});
function loadAnimation() {
timeline.to(".listaProductos .producto", {
  duration: 3,
  opacity: 1,
  stagger: 0.3
});
timeline.play();
}
function reducirTamano(){
  for (const a of document.querySelectorAll(".linea")) {
    
    var text=a.textContent;
    var length = 18;
    var trimmedString = text.length > length ? 
                    text.substring(0, 21) + "..." : 
                    text;
     a.textContent = trimmedString;

  }
}

function cargarData(){

  fetch('./lib/panaderia.json').then(function(response) {
    let text="";
    if(response.ok) {
      response.json().then(function(response) {
        
        let data=response.data.Panes.slice(0,5);
         
        for (const productos of data) {
          let text2="<div class='producto'><div class='nombreProducto'>"+productos.descripcion+"</div><div class='precioProducto'>"+productos.precio+"</div></div>"
          text+=text2;
        }
        document.querySelector(".listaProductos").innerHTML=text;
        loadAnimation()
      });
    } else {
      console.log('Respuesta de red OK pero respuesta HTTP no OK');
    }
  })
  .catch(function(error) {
    console.log('Hubo un problema con la petición Fetch:' + error.message);
  });
}

setInterval(function(){
  let text="";
 
  fetch('./lib/panaderia.json').then(function(response) {
    if(response.ok) {
      response.json().then(function(response) {
        document.querySelector(".listaProductos").innerHTML="";
        let data=response.data.Panes.slice(contador,contador+5);
         
        for (const productos of data) {
          let text2="<div class='producto'><div class='nombreProducto'>"+productos.descripcion+"</div><div class='precioProducto'>"+productos.precio+"</div></div>"
          text+=text2;
        }
        document.querySelector(".listaProductos").innerHTML=text;
        loadAnimation()
        if(contador>=response.data.Panes.length-5){
          contador=0;
          }else{
          contador=contador+4;
          }
      });
    } else {
      console.log('Respuesta de red OK pero respuesta HTTP no OK');
    }
  })
  .catch(function(error) {
    console.log('Hubo un problema con la petición Fetch:' + error.message);
  });
}
  , 60000);
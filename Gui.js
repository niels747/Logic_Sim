/*
Minimalistic  GUI made by Niels Daemen
*/

class Gui
{
  width;
  height;
  UI;      // main UI div element
  table;
  intVars; // Internal object Holding the actual data
  extVars; // External object accessible from outside

  constructor(extVarsIn, width, height)
  {
    this.width = width;
    this.height = height;

    this.UI = document.createElement('div');
    this.UI.style.width = width + 'px';
    this.UI.style.height = height + 'px';
    this.UI.style.backgroundColor = 'green';
    this.UI.style.float = 'right';

    //// LOG OBJECT BUTTON ONLY FOR DEBUG //////////////////////
    let button = document.createElement('button');
    button.type = 'button';
    button.innerHTML = 'log';
    button.onclick = function() {
      console.log(extVarsIn); // log all props
    };
    this.UI.appendChild(button);
    //\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\

    this.table = document.createElement('table');
    this.UI.appendChild(this.table);
    document.body.appendChild(this.UI);

    this.extVars = extVarsIn; // add ref to external object
    this.intVars = {};
  }

  getSelectedIndex(name) // only works for select inputs
  {
    return document.getElementById('GUI_' + name).selectedIndex;
  }

  setSelectedIndex(name, index) // only works for select inputs
  {
    document.getElementById('GUI_' + name).selectedIndex = index;
  }

  addToggle(name)
  {
    let row = this.#addRow();
    row.appendChild(this.#createLabel(name));
    let toggle = document.createElement('input');
    toggle.type = 'checkbox';
    toggle.id = 'GUI_' + name;
    row.appendChild(toggle);
    let intVarsRef = this.intVars;

    this.#addProp(name, false, 'bool', toggle);

    toggle.oninput = function() { intVarsRef[name] = toggle.checked; };
  }

  addSelect(name, ...args)
  {
    let row = this.#addRow();
    row.appendChild(this.#createLabel(name));
    let select = document.createElement('select');
    select.id = 'GUI_' + name;
    select.style.width = '100%';
    for (let i = 0; i < args.length; i++) {
      let opt = document.createElement('option');
      opt.value = args[i];
      opt.innerHTML = args[i];
      select.appendChild(opt);
    }
    let td = document.createElement('td');
    td.appendChild(select);
    row.appendChild(td);
    this.#addProp(name, args[0], 'string', select);
    let intVarsRef = this.intVars;
    select.oninput = function() { intVarsRef[name] = select.value; };
  }

  addSlider(name, min, max, step = 1)
  {
    let row = this.#addRow();
    row.appendChild(this.#createLabel(name));
    let val = min;
    let slider = this.#appendSlider(row);
    slider.id = 'GUI_' + name;
    slider.min = min;
    slider.max = max;
    slider.step = step;
    slider.value = val;
    slider.style.width = '220px';
    let output = document.createElement('output');
    output.htmlFor = 'GUI_' + name;
    output.value = val;
    let td = document.createElement('td');
    td.appendChild(output);
    row.appendChild(td);
    this.#addProp(name, val, 'num', slider, output);
    let intVarsRef = this.intVars;
    slider.oninput = function() {
      output.value = slider.value;
      intVarsRef[name] = parseFloat(slider.value);
    };
  }

  #createLabel(name)
  {
    let td = document.createElement('td');
    let label = document.createElement('label');
    label.htmlFor = 'GUI_' + name;
    label.innerHTML = name;
    td.appendChild(label);
    return td;
  }

  #addRow()
  {
    let row = document.createElement('tr');
    this.table.appendChild(row);
    return row;
  }

  #appendSlider(parent)
  {
    let td = document.createElement('td');
    let slider = document.createElement('input');
    slider.type = 'range';
    td.appendChild(slider);
    parent.appendChild(td);
    return slider;
  }

  #addProp(name, val, type, controlEl, outputEl)
  {
    Object.defineProperty(this.intVars, name, {value : val, writable : true});

    let intVarsRef = this.intVars;

    Object.defineProperty(this.extVars, name, {
      get() { return intVarsRef[name]; },
      set(newVal) {
        //   console.log('Try to set ' + name + ' to: ' + newVal);
        // set the html element and make use of its min and max
        // to constrain the value

        if (type == 'num') {
          controlEl.value = newVal;
          intVarsRef[name] = parseFloat(controlEl.value);
        } else if (type == 'bool') {
          controlEl.checked = newVal;
          intVarsRef[name] = controlEl.checked;
        } else if (type == 'string') {
          controlEl.value = newVal;
          intVarsRef[name] = controlEl.value;
        }

        if (outputEl) {
          outputEl.value = intVarsRef[name];
        }
        //  console.log('After setting: ' + this[name]);
      }
    });
  }
}
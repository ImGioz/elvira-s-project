from flask import Flask, jsonify, render_template, request
import sqlite3
from flask_cors import CORS
from escpos.printer import Network 
import requests
import threading
from flask_socketio import SocketIO


app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})
socketio = SocketIO(app)

@socketio.on('new_order')
def handle_new_order(data):
    print('New order received:', data)
    socketio.emit('new_order', data)

def get_db_connection():
    conn = sqlite3.connect('restaurant.db')
    conn.row_factory = sqlite3.Row 
    return conn

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/tables')
def get_tables():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM Tables')
    tables = cursor.fetchall()
    conn.close()

    
    tables_data = [{
        'id': table['id'],
        'location': table['location'],
        'table_number': table['table_number'],
        'ta_number': table['ta_number'],
        'width_percentage': table['width_percentage'],
        'height_percentage': table['height_percentage'],
        'x_position_percentage': table['x_position_percentage'],
        'y_position_percentage': table['y_position_percentage']
    } for table in tables]

    return jsonify(tables_data)

@app.route('/products')
def get_products_by_category():
    category_number = request.args.get('category_number')
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM products WHERE category_number = ? AND status = "active"', (category_number,))
    products = cursor.fetchall()
    conn.close()

    products_data = [{
        'product_number': product['product_number'],
        'product_name_int': product['product_name_int'],
        'category_number': product['category_number'],
        'option_group_number': product['option_group_number'], 
    } for product in products]

    return jsonify(products_data)

@app.route('/product_options')
def get_product_options():
    option_group_number = request.args.get('option_group_number')
    print('Requested Option Group Number:', option_group_number) 

    if option_group_number is None:
        return jsonify({'error': 'No option group number provided.'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute('SELECT * FROM product_options WHERE option_group_number = ?', (option_group_number,))
        options = cursor.fetchall()
        print('Raw Fetched Options:', options)  

        if not options:
            print('No options found for the provided group number.')
            return jsonify([])  

        options_data = [{
            'id': option['id'],
            'option_details': option['option_details'],
            'option_group_number': option['option_group_number'],
            'option_number': option['option_number']
        } for option in options]

        print('Options Data:', options_data) 
        return jsonify(options_data)

    except Exception as e:
        print('Database error:', str(e))
        return jsonify({'error': 'Database query failed.'}), 500
    finally:
        conn.close()

@app.route('/categories')
def get_categories():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM item_category WHERE status = "active"')
    categories = cursor.fetchall()
    conn.close()

    categories_data = [{
        'id': category['id'],
        'category_name': category['category_name'],
        'category_number': category['category_number']
    } for category in categories]

    return jsonify(categories_data)


@app.route('/orders', methods=['GET'])
def get_orders():
    table_number = request.args.get('table_number')
    status = request.args.get('status', 'pending')

    conn = get_db_connection()
    cursor = conn.cursor()

    query = '''
    SELECT DISTINCT o.id, o.timestamp, o.table_number, o.product_number, 
           p.product_name_int, o.option_number, 
           po.option_details, o.option_text
    FROM Orders o
    LEFT JOIN products p ON o.product_number = p.product_number
    LEFT JOIN product_options po ON o.option_number = po.option_number
    WHERE o.status = ?
    '''
    params = [status]
    
    if table_number:
        query += ' AND o.table_number = ?'
        params.append(table_number)

    cursor.execute(query, params)
    orders = cursor.fetchall()
    conn.close()

    orders_data = [{
        'id': order['id'],
        'timestamp': order['timestamp'],
        'table_number': order['table_number'],
        'product_number': order['product_number'],
        'product_name': order['product_name_int'],
        'option_number': order['option_number'],
        'option_details': order['option_details'],
        'option_text': order['option_text']
    } for order in orders]

    return jsonify(orders_data)


def get_orders_external(table_number, status):
    base_url = request.host_url
    response = requests.get(f'{base_url}orders?table_number={table_number}&status={status}')
    return response.json(), response.status_code


@app.route('/orders', methods=['POST'])
def save_order():
    data = request.json
    product_number = data.get('product_number')
    category_number = data.get('category_number')
    option_number = data.get('option_number')
    option_text = data.get('option_text', '')
    table_number = data.get('table_number')
    status = data.get('status')
    print("Received order for table:", data['table_number'])


    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute(''' 
        INSERT INTO Orders (product_number, category_number, option_number, option_text, table_number, status)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', (product_number, category_number, option_number, option_text, table_number, status))

    conn.commit()
    conn.close()

    socketio.emit('new_order', {'table_number': table_number})

    return jsonify({'message': 'Order added successfully!'}), 201




@app.route('/orderss', methods=['POST'])
def add_order():
    order_data = request.json
    new_order = Order(
        product_number=order_data['product_number'],
        category_number=order_data['category_number'],
        option_number=order_data['option_number'],
        option_text=order_data['option_text'],
        table_number=order_data['table_number'],
        status=order_data['status']
    )
    
    db.session.add(new_order)
    db.session.commit()

    return jsonify({'message': 'Order added successfully!'}), 201

def update_orders_internal(table_number):
    response = update_orders()
    return response.get_data()

def get_orders_internal(table_number, status):
    with app.test_request_context(f'/orders?table_number={table_number}&status={status}'):
        return get_orders()

@app.route('/discard_orders', methods=['POST'])
def discard_orders():
    table_number = request.args.get('table_number')
    
    if not table_number:
        return "Table number is required", 400

    try:
        db = get_db_connection()
        cursor = db.execute("UPDATE orders SET status='deleted' WHERE table_number=?", (table_number,))
        db.commit()

        time.sleep(1)

        orders_response = get_orders_external(table_number, status='open')
        return orders_response

    except Exception as e:
        print(f"Ошибка при удалении заказов: {e}")
        return 'Internal server error', 500
    finally:
        db.close()


@app.route('/discard_order/<int:order_id>', methods=['POST'])
def discard_order(order_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('UPDATE Orders SET status = "deleted" WHERE id = ?', (order_id,))
    conn.commit()
    conn.close()
    return jsonify({'message': 'Order discarded successfully!'}), 200

@app.route('/close_orders', methods=['POST'])
def close_orders():
    table_number = request.args.get('table_number')
    
    if not table_number:
        return "Table number is required", 400

    try:
        db = get_db_connection() 
        cursor = db.execute("UPDATE orders SET status='closed' WHERE table_number=? AND status='open'", (table_number,))
        db.commit()
        
        return '', 200 
    except Exception as e:
        print(f"Ошибка при обновлении заказов: {e}")
        return 'Internal server error', 500
    finally:
        db.close()

@app.route('/remove_orders', methods=['POST'])
def remove_orders():
    table_number = request.args.get('table_number')
    
    if not table_number:
        return jsonify({"error": "Table number is required"}), 400

    try:
        db = get_db_connection()
        cursor = db.execute("UPDATE orders SET status='deleted' WHERE table_number=?", (table_number,))
        db.commit()
        time.sleep(1)

        orders_response = get_orders_external(table_number, status='open')
        return jsonify(orders_response)

    except Exception as e:
        print(f"Ошибка при удалении заказов: {e}")
        return jsonify({"error": "Internal server error"}), 500
    finally:
        db.close()

@app.route('/remove_order/<int:order_id>', methods=['POST'])
def remove_order(order_id):
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute('UPDATE orders SET status = ? WHERE id = ?', ('deleted', order_id))
        conn.commit()
        if cursor.rowcount == 0:
            return jsonify({'error': 'Order not found'}), 404

        printer_ip = '192.168.1.90', '192.168.1.91'
        threading.Thread(target=print_deletion_receipt, args=(printer_ip, order_id)).start()

        return jsonify({'message': 'Order removed successfully!'}), 200
    except Exception as e:
        print(f"Ошибка при удалении заказа: {e}")
        return jsonify({'error': 'Internal server error'}), 500
    finally:
        conn.close()

def print_deletion_receipt(ip, order_id):
    try:
        printer = Network(ip)
        print('Принтер успешно подключен.')

        conn = get_db_connection()
        cursor = conn.execute("SELECT * FROM orders WHERE id = ?", (order_id,))
        order = cursor.fetchone()

        if order:
            printer.set(align='center', width=2, height=2, bold=True)
            printer.text(f'Заказ удален: {order["product_name"]}\n\n') 

            timestamp = time.strftime('%H:%M:%S')
            printer.text(f'Timestamp: {timestamp}')
            printer.cut(mode='full')
            print(f'Чек успешно напечатан на принтере {ip}')
        else:
            print(f'Заказ с ID {order_id} не найден для печати.')

    except Exception as e:
        print(f'Ошибка при печати на {ip}: {e}')

@app.route('/update_orders', methods=['POST'])
def update_orders():
    table_number = request.args.get('table_number')
    
    if not table_number:
        return "Table number is required", 400

    try:
        db = get_db_connection()
        cursor = db.execute("UPDATE orders SET status='open' WHERE table_number=? AND status='pending'", (table_number,))
        db.commit()

        time.sleep(1)

        orders_response = get_orders_external(table_number, status='open')
        return orders_response

    except Exception as e:
        print(f"Ошибка при обновлении заказов: {e}")
        return 'Internal server error', 500
    finally:
        db.close()


@app.route('/print_order', methods=['POST'])
def print_order_endpoint():
    data = request.json
    table_number = data.get('table_number')
    orders = data.get('orders', [])

    ordered_items = []
    printer_86_items = [] 
    printer_87_items = []

    for order in orders:
        if 'product_number' in order:
            item = {
    'product_number': order['product_number'],
    'product_name_int': order.get('product_name_int', order.get('product_name', 'Unknown Product')),
    'option_details': order.get('option_details', 'No option'),
    'option_text': order.get('option_text')
}

            ordered_items.append(item)

            if check_device_exists(order['product_number']):
                printer_86_items.append(item)
            else:
                printer_87_items.append(item)
        else:
            print(f"Ошибка: отсутствует 'product_number' в заказе: {order}")

    if printer_86_items:
        print_order('192.168.1.91', table_number, printer_86_items)
    if printer_87_items:
        print_order('192.168.1.90', table_number, printer_87_items)

    return jsonify({'message': 'Order printed successfully!'}), 200


def check_device_exists(product_number):
    conn = get_db_connection() 
    try:
        cursor = conn.execute("SELECT 1 FROM devices WHERE product_number = ?", (product_number,))
        result = cursor.fetchone()  
        return result is not None
    finally:
        conn.close() 


def print_order(ip, table_number, ordered_items):
    print(f'Заказ для печати на {ip}: {ordered_items}') 
    try:
        print(f'Подключение к принтеру на {ip}...')
        printer = Network(ip)  
        print('Принтер успешно подключен.')

        printer.set(align='center', width=2, height=2, bold=True)  

        printer.text(f'Table: {table_number}\n\n')

        for item in ordered_items:
            product_name = item.get('product_name_int')
            option_details = item.get('option_details', 'No option')
            option_text = item.get('option_text', 'No comment')

            printer.set(align='right', width=2, height=2, bold=True)  
            printer.text(f'{product_name}\n')
            printer.text(f'Options: {option_details}\n')
            printer.text(f'Comment: {option_text}\n\n')
            printer.set(align='center', width=1, height=1)  

        timestamp = datetime.now().strftime('%H:%M:%S')
        printer.text(f'Timestamp: {timestamp}')
        printer.cut(mode='full')
        print(f'Чек успешно напечатан и обрезан на принтере {ip}')

    except Exception as e:
        print(f'Ошибка при печати на {ip}: {e}')

from datetime import datetime
import time

@app.route('/table_orders', methods=['GET'])
def get_table_orders():
    table_number = request.args.get('table_number')

    if not table_number:
        return jsonify({'error': 'Table number is required.'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('SELECT * FROM Orders WHERE table_number = ? AND status = "pending"', (table_number,))
    orders = cursor.fetchall()
    conn.close()

    orders_data = [{
        'id': order['id'],
        'product_number': order['product_number'],
        'category_number': order['category_number'],
        'option_number': order['option_number'],
        'option_text': order['option_text'],
        'timestamp': order['timestamp']
    } for order in orders]

    return jsonify(orders_data)

@app.route('/options', methods=['GET'])
def get_options_by_ids():
    ids = request.args.get('ids').split(',')
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('SELECT * FROM product_options WHERE id IN ({})'.format(','.join('?' * len(ids))), ids)
    options = cursor.fetchall()
    conn.close()
    
    options_data = [{
        'id': option['id'],
        'option_details': option['option_details']
    } for option in options]
    
    return jsonify(options_data)


if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5012)